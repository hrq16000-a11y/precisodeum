-- ============================================================
-- Sub-lote 4.4: Viral Loop & Referrals (usa tabela existente)
-- ============================================================

-- 1) Acrescenta colunas que faltam à tabela referrals existente
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS qualified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rewarded_at timestamptz;

-- Garante unicidade do indicado (cada user só pode ter 1 indicação ativa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referrals_referred_id_unique'
  ) THEN
    BEGIN
      ALTER TABLE public.referrals
        ADD CONSTRAINT referrals_referred_id_unique UNIQUE (referred_id);
    EXCEPTION WHEN duplicate_table OR unique_violation THEN
      NULL;
    END;
  END IF;
END $$;

-- Não pode indicar a si próprio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referrals_no_self'
  ) THEN
    BEGIN
      ALTER TABLE public.referrals
        ADD CONSTRAINT referrals_no_self CHECK (referrer_id <> referred_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals (status);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON public.referrals (referral_code);

-- RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Referrer le suas indicacoes" ON public.referrals;
CREATE POLICY "Referrer le suas indicacoes"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Admin gerencia referrals" ON public.referrals;
CREATE POLICY "Admin gerencia referrals"
ON public.referrals FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) RPC: register_referral
CREATE OR REPLACE FUNCTION public.register_referral(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code text := NULLIF(btrim(COALESCE(_code, '')), '');
  v_referrer uuid;
  v_existing uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  IF v_code IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  SELECT id INTO v_referrer FROM public.profiles WHERE user_ref = v_code LIMIT 1;
  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('status', 'code_not_found');
  END IF;

  IF v_referrer = v_user THEN
    RETURN jsonb_build_object('status', 'self_referral_blocked');
  END IF;

  SELECT id INTO v_existing FROM public.referrals WHERE referred_id = v_user LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_referred', 'referral_id', v_existing);
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, referral_code, status, metadata)
  VALUES (v_referrer, v_user, v_code, 'pending', jsonb_build_object('source', 'signup_link'))
  RETURNING id INTO v_existing;

  RETURN jsonb_build_object('status', 'ok', 'referral_id', v_existing, 'referrer_id', v_referrer);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_referral(text) TO authenticated;

-- 3) RPC: get_my_referrals_summary
CREATE OR REPLACE FUNCTION public.get_my_referrals_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_ref text;
  v_total bigint := 0;
  v_qualified bigint := 0;
  v_points bigint := 0;
  v_items jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('available', false);
  END IF;

  SELECT user_ref INTO v_ref FROM public.profiles WHERE id = v_user;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('qualified','rewarded','completed')),
    COALESCE(SUM(points_awarded), 0)
  INTO v_total, v_qualified, v_points
  FROM public.referrals WHERE referrer_id = v_user;

  WITH recent AS (
    SELECT
      r.id, r.status, r.points_awarded, r.created_at, r.rewarded_at,
      COALESCE(p.full_name, 'Profissional') AS referred_name
    FROM public.referrals r
    LEFT JOIN public.profiles p ON p.id = r.referred_id
    WHERE r.referrer_id = v_user
    ORDER BY r.created_at DESC
    LIMIT 10
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'status', status,
    'reward_points', points_awarded,
    'created_at', created_at,
    'rewarded_at', rewarded_at,
    'referred_name', referred_name
  ) ORDER BY created_at DESC)
  INTO v_items
  FROM recent;

  RETURN jsonb_build_object(
    'available', true,
    'user_ref', v_ref,
    'total', v_total,
    'qualified', v_qualified,
    'points_earned', v_points,
    'recent', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_referrals_summary() TO authenticated;

-- 4) Trigger: ao criar 1ª daily_post, recompensa o referrer (+50 pts)
CREATE OR REPLACE FUNCTION public.award_referral_after_first_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_count integer;
  v_referral RECORD;
  v_already_logged boolean;
BEGIN
  SELECT COUNT(*) INTO v_post_count
  FROM public.daily_posts WHERE user_id = NEW.user_id;

  IF v_post_count <> 1 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_referral
  FROM public.referrals
  WHERE referred_id = NEW.user_id AND status = 'pending'
  LIMIT 1;

  IF v_referral.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.engagement_log
    WHERE user_id = v_referral.referrer_id
      AND action_key = 'referral_first_post'
      AND metadata->>'referral_id' = v_referral.id::text
  ) INTO v_already_logged;

  IF v_already_logged THEN
    RETURN NEW;
  END IF;

  UPDATE public.referrals
  SET status = 'rewarded',
      points_awarded = 50,
      qualified_at = COALESCE(qualified_at, now()),
      rewarded_at = now(),
      completed_at = COALESCE(completed_at, now())
  WHERE id = v_referral.id;

  BEGIN
    INSERT INTO public.engagement_log (user_id, points_awarded, action_key, metadata)
    VALUES (
      v_referral.referrer_id,
      50,
      'referral_first_post',
      jsonb_build_object(
        'referral_id', v_referral.id,
        'referred_id', NEW.user_id,
        'daily_post_id', NEW.id
      )
    );

    UPDATE public.profiles
    SET engagement_points = COALESCE(engagement_points, 0) + 50
    WHERE id = v_referral.referrer_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (
      v_referral.referrer_id,
      'referral_rewarded',
      'referral',
      v_referral.id::text,
      jsonb_build_object('referred_id', NEW.user_id, 'points', 50)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_referral_after_first_post ON public.daily_posts;
CREATE TRIGGER trg_award_referral_after_first_post
AFTER INSERT ON public.daily_posts
FOR EACH ROW
EXECUTE FUNCTION public.award_referral_after_first_post();