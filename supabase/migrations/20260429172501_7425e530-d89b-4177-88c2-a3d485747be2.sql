CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow text NOT NULL,
  email_normalized text,
  ip_hash text,
  attempt_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  cooldown_until timestamptz,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT auth_rate_limits_flow_check CHECK (flow IN ('login','forgot_password')),
  CONSTRAINT auth_rate_limits_email_or_ip_check CHECK (email_normalized IS NOT NULL OR ip_hash IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_rate_limits_flow_email_ip_key
  ON public.auth_rate_limits (flow, COALESCE(email_normalized, ''), COALESCE(ip_hash, ''));

CREATE INDEX IF NOT EXISTS auth_rate_limits_flow_cooldown_idx
  ON public.auth_rate_limits (flow, cooldown_until);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to auth_rate_limits" ON public.auth_rate_limits;
CREATE POLICY "No direct access to auth_rate_limits"
ON public.auth_rate_limits
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "No anonymous access to auth_rate_limits" ON public.auth_rate_limits;
CREATE POLICY "No anonymous access to auth_rate_limits"
ON public.auth_rate_limits
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.touch_provider_last_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'providers' THEN
    NEW.last_active_at := now();
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'services' THEN
    UPDATE public.providers
       SET last_active_at = now()
     WHERE id = NEW.provider_id;
    RETURN NEW;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_auth_rate_limit(
  _flow text,
  _email_normalized text,
  _ip_hash text,
  _success boolean DEFAULT false,
  _max_attempts integer DEFAULT 5,
  _window_minutes integer DEFAULT 10,
  _cooldown_minutes integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_now timestamptz := now();
  v_row public.auth_rate_limits%ROWTYPE;
  v_effective_email text := NULLIF(lower(trim(COALESCE(_email_normalized, ''))), '');
  v_effective_ip text := NULLIF(trim(COALESCE(_ip_hash, '')), '');
  v_window interval := make_interval(mins => GREATEST(_window_minutes, 1));
  v_cooldown interval := make_interval(mins => GREATEST(_cooldown_minutes, 1));
  v_remaining_seconds integer := 0;
BEGIN
  IF _flow NOT IN ('login', 'forgot_password') THEN
    RAISE EXCEPTION 'invalid_flow';
  END IF;

  INSERT INTO public.auth_rate_limits (flow, email_normalized, ip_hash)
  VALUES (_flow, v_effective_email, v_effective_ip)
  ON CONFLICT (flow, COALESCE(email_normalized, ''), COALESCE(ip_hash, '')) DO NOTHING;

  SELECT *
    INTO v_row
    FROM public.auth_rate_limits
   WHERE flow = _flow
     AND COALESCE(email_normalized, '') = COALESCE(v_effective_email, '')
     AND COALESCE(ip_hash, '') = COALESCE(v_effective_ip, '')
   FOR UPDATE;

  IF v_row.cooldown_until IS NOT NULL AND v_row.cooldown_until > v_now THEN
    v_remaining_seconds := GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (v_row.cooldown_until - v_now)))::integer);
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining_seconds', v_remaining_seconds,
      'attempt_count', v_row.attempt_count,
      'cooldown_until', v_row.cooldown_until
    );
  END IF;

  IF v_row.window_started_at < (v_now - v_window) THEN
    v_row.attempt_count := 0;
    v_row.window_started_at := v_now;
  END IF;

  IF _success THEN
    UPDATE public.auth_rate_limits
       SET attempt_count = 0,
           cooldown_until = NULL,
           last_success_at = v_now,
           last_attempt_at = v_now,
           window_started_at = v_now
     WHERE id = v_row.id;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining_seconds', 0,
      'attempt_count', 0,
      'cooldown_until', NULL
    );
  END IF;

  v_row.attempt_count := COALESCE(v_row.attempt_count, 0) + 1;

  UPDATE public.auth_rate_limits
     SET attempt_count = v_row.attempt_count,
         last_attempt_at = v_now,
         window_started_at = COALESCE(v_row.window_started_at, v_now),
         cooldown_until = CASE
           WHEN v_row.attempt_count >= GREATEST(_max_attempts, 1) THEN v_now + v_cooldown
           ELSE NULL
         END
   WHERE id = v_row.id
   RETURNING * INTO v_row;

  v_remaining_seconds := CASE
    WHEN v_row.cooldown_until IS NOT NULL AND v_row.cooldown_until > v_now
      THEN GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (v_row.cooldown_until - v_now)))::integer)
    ELSE 0
  END;

  RETURN jsonb_build_object(
    'allowed', v_remaining_seconds = 0,
    'remaining_seconds', v_remaining_seconds,
    'attempt_count', v_row.attempt_count,
    'cooldown_until', v_row.cooldown_until
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.peek_auth_rate_limit(
  _flow text,
  _email_normalized text,
  _ip_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_now timestamptz := now();
  v_row public.auth_rate_limits%ROWTYPE;
  v_effective_email text := NULLIF(lower(trim(COALESCE(_email_normalized, ''))), '');
  v_effective_ip text := NULLIF(trim(COALESCE(_ip_hash, '')), '');
  v_remaining_seconds integer := 0;
BEGIN
  SELECT *
    INTO v_row
    FROM public.auth_rate_limits
   WHERE flow = _flow
     AND COALESCE(email_normalized, '') = COALESCE(v_effective_email, '')
     AND COALESCE(ip_hash, '') = COALESCE(v_effective_ip, '');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'active', false,
      'remaining_seconds', 0,
      'attempt_count', 0,
      'cooldown_until', NULL
    );
  END IF;

  IF v_row.cooldown_until IS NOT NULL AND v_row.cooldown_until > v_now THEN
    v_remaining_seconds := GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (v_row.cooldown_until - v_now)))::integer);
  END IF;

  RETURN jsonb_build_object(
    'active', v_remaining_seconds > 0,
    'remaining_seconds', v_remaining_seconds,
    'attempt_count', COALESCE(v_row.attempt_count, 0),
    'cooldown_until', v_row.cooldown_until
  );
END;
$$;