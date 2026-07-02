
-- 1. Add suspicion columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspicious boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspicious_reason text,
  ADD COLUMN IF NOT EXISTS suspicious_ip text,
  ADD COLUMN IF NOT EXISTS suspicious_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_is_suspicious ON public.profiles (is_suspicious) WHERE is_suspicious = true;

-- 2. ip_blocks table
CREATE TABLE IF NOT EXISTS public.ip_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  reason text NOT NULL DEFAULT 'rate_limit_signup',
  signup_count integer NOT NULL DEFAULT 0,
  blocked_until timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ip_blocks_ip ON public.ip_blocks (ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_blocks_created_at ON public.ip_blocks (created_at DESC);

ALTER TABLE public.ip_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read ip_blocks" ON public.ip_blocks;
CREATE POLICY "Admins can read ip_blocks"
  ON public.ip_blocks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Trigger function: detects rate-limited signups based on user_access_logs
CREATE OR REPLACE FUNCTION public.detect_signup_abuse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip text;
  v_recent_count integer;
  v_threshold integer := 3;
  v_window interval := interval '10 minutes';
  v_block_window interval := interval '30 minutes';
  v_already_blocked boolean;
BEGIN
  -- Find the most recent signup IP for this user from access logs
  SELECT ip_address INTO v_ip
  FROM public.user_access_logs
  WHERE user_id = NEW.id
    AND ip_address IS NOT NULL AND ip_address <> ''
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_ip IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count recent signups from same IP (joining via access logs)
  SELECT COUNT(DISTINCT l.user_id) INTO v_recent_count
  FROM public.user_access_logs l
  JOIN public.profiles p ON p.id = l.user_id
  WHERE l.ip_address = v_ip
    AND p.created_at >= now() - v_window;

  IF v_recent_count >= v_threshold THEN
    -- Register IP block (idempotent within window)
    SELECT EXISTS (
      SELECT 1 FROM public.ip_blocks
      WHERE ip_address = v_ip AND blocked_until > now()
    ) INTO v_already_blocked;

    IF NOT v_already_blocked THEN
      INSERT INTO public.ip_blocks (ip_address, reason, signup_count, blocked_until)
      VALUES (v_ip, 'rate_limit_signup', v_recent_count, now() + v_block_window);
    END IF;

    -- Mark all profiles from this IP in the last 30 min as suspicious
    UPDATE public.profiles
    SET is_suspicious = true,
        suspicious_reason = 'Múltiplos cadastros (' || v_recent_count || ') detectados no IP ' || v_ip,
        suspicious_ip = v_ip,
        suspicious_at = COALESCE(suspicious_at, now())
    WHERE id IN (
      SELECT DISTINCT l.user_id
      FROM public.user_access_logs l
      JOIN public.profiles p ON p.id = l.user_id
      WHERE l.ip_address = v_ip
        AND p.created_at >= now() - v_block_window
    );

    -- Audit log
    INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (
      NEW.id,
      'ip_blocked_rate_limit',
      'profile',
      NEW.id::text,
      jsonb_build_object(
        'ip_address', v_ip,
        'signup_count', v_recent_count,
        'window_minutes', 10,
        'block_minutes', 30
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_signup_abuse ON public.profiles;
CREATE TRIGGER trg_detect_signup_abuse
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_signup_abuse();

-- 4. Admin RPCs

CREATE OR REPLACE FUNCTION public.admin_suspicious_summary(_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_list jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.profiles WHERE is_suspicious = true;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_list FROM (
    SELECT id, full_name, email, suspicious_ip, suspicious_reason, suspicious_at, created_at, profile_type
    FROM public.profiles
    WHERE is_suspicious = true
    ORDER BY suspicious_at DESC NULLS LAST, created_at DESC
    LIMIT _limit
  ) x;

  RETURN jsonb_build_object('total', v_total, 'profiles', v_list);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_recent_ip_blocks(_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, ip_address text, reason text, signup_count integer, blocked_until timestamptz, created_at timestamptz, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id, b.ip_address, b.reason, b.signup_count, b.blocked_until, b.created_at,
         (b.blocked_until > now()) AS active
  FROM public.ip_blocks b
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY b.created_at DESC
  LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_suspicion(_user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cnt integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  IF _user_ids IS NULL OR array_length(_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.profiles
  SET is_suspicious = false,
      suspicious_reason = NULL,
      suspicious_at = NULL
  WHERE id = ANY(_user_ids);
  GET DIAGNOSTICS cnt = ROW_COUNT;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'clear_suspicion', 'profile', NULL,
          jsonb_build_object('count', cnt, 'user_ids', to_jsonb(_user_ids)));

  RETURN cnt;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_ban_suspicious(_user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cnt integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  IF _user_ids IS NULL OR array_length(_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.profiles
  SET status = 'banned'
  WHERE id = ANY(_user_ids) AND is_suspicious = true;
  GET DIAGNOSTICS cnt = ROW_COUNT;

  -- Soft-delete linked providers
  UPDATE public.providers
  SET deleted_at = now()
  WHERE user_id = ANY(_user_ids) AND deleted_at IS NULL;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'ban_suspicious_bulk', 'profile', NULL,
          jsonb_build_object('count', cnt, 'user_ids', to_jsonb(_user_ids)));

  RETURN cnt;
END;
$$;
