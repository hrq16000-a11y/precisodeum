
-- 1) FIX gamification_levels.max_points
UPDATE public.gamification_levels SET max_points = 99    WHERE name = 'Iniciante';
UPDATE public.gamification_levels SET max_points = 299   WHERE name = 'Entusiasta';
UPDATE public.gamification_levels SET max_points = 699   WHERE name = 'Engajado';
UPDATE public.gamification_levels SET max_points = 1499  WHERE name = 'Ouro';
UPDATE public.gamification_levels SET max_points = 2999  WHERE name = 'Platina';
UPDATE public.gamification_levels SET max_points = 4999  WHERE name = 'Diamante';
UPDATE public.gamification_levels SET max_points = NULL  WHERE name = 'Mestre';

-- 2) Score rules de onboarding (com label)
INSERT INTO public.score_rules (action_key, label, points, max_per_day, cooldown_hours, active)
VALUES
  ('onboarding_basic_complete',        'Cadastro básico completo',        50,  1, 0, true),
  ('onboarding_first_service',         'Primeiro serviço cadastrado',     30,  1, 0, true),
  ('onboarding_first_portfolio_album', 'Primeiro álbum de portfólio',     30,  1, 0, true),
  ('onboarding_checkin_7days',         '7 dias seguidos de check-in',    100,  1, 0, true),
  ('daily_checkin',                    'Check-in diário',                   5,  1, 0, true)
ON CONFLICT (action_key) DO UPDATE SET
  label = EXCLUDED.label,
  points = EXCLUDED.points,
  max_per_day = EXCLUDED.max_per_day,
  active = true;

-- 3) Tabela daily_checkins
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  streak_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date
  ON public.daily_checkins (user_id, checkin_date DESC);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own checkins" ON public.daily_checkins;
CREATE POLICY "Users see own checkins"
  ON public.daily_checkins FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users insert own checkins" ON public.daily_checkins;
CREATE POLICY "Users insert own checkins"
  ON public.daily_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4) register_daily_checkin
CREATE OR REPLACE FUNCTION public.register_daily_checkin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_yesterday date := CURRENT_DATE - 1;
  v_last_checkin record;
  v_new_streak int := 1;
  v_already_today boolean;
  v_seven_done boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.daily_checkins
    WHERE user_id = v_user_id AND checkin_date = CURRENT_DATE
  ) INTO v_already_today;

  IF v_already_today THEN
    SELECT streak_count INTO v_new_streak
    FROM public.daily_checkins
    WHERE user_id = v_user_id AND checkin_date = CURRENT_DATE;
    RETURN jsonb_build_object('already_done_today', true, 'streak', v_new_streak);
  END IF;

  SELECT * INTO v_last_checkin
  FROM public.daily_checkins
  WHERE user_id = v_user_id
  ORDER BY checkin_date DESC
  LIMIT 1;

  IF v_last_checkin IS NOT NULL AND v_last_checkin.checkin_date = v_yesterday THEN
    v_new_streak := v_last_checkin.streak_count + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  INSERT INTO public.daily_checkins (user_id, checkin_date, streak_count)
  VALUES (v_user_id, CURRENT_DATE, v_new_streak);

  PERFORM public.award_engagement_points(v_user_id, 'daily_checkin',
    jsonb_build_object('streak', v_new_streak, 'date', CURRENT_DATE));

  IF v_new_streak >= 7 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.engagement_log
      WHERE user_id = v_user_id AND action_key = 'onboarding_checkin_7days'
    ) INTO v_seven_done;
    IF NOT v_seven_done THEN
      PERFORM public.award_engagement_points(v_user_id, 'onboarding_checkin_7days',
        jsonb_build_object('streak', v_new_streak));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'already_done_today', false,
    'streak', v_new_streak,
    'points_awarded', 5,
    'milestone_7d', (v_new_streak >= 7)
  );
END;
$$;

-- 5) Trigger 1º serviço
CREATE OR REPLACE FUNCTION public.trg_award_onboarding_first_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_count int;
  v_already boolean;
BEGIN
  v_user_id := NEW.user_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM public.services
  WHERE user_id = v_user_id AND deleted_at IS NULL;

  IF v_count = 1 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.engagement_log
      WHERE user_id = v_user_id AND action_key = 'onboarding_first_service'
    ) INTO v_already;
    IF NOT v_already THEN
      PERFORM public.award_engagement_points(v_user_id, 'onboarding_first_service',
        jsonb_build_object('service_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_first_service ON public.services;
CREATE TRIGGER trg_onboarding_first_service
AFTER INSERT ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.trg_award_onboarding_first_service();

-- 6) Trigger 1º álbum portfólio
CREATE OR REPLACE FUNCTION public.trg_award_onboarding_first_portfolio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_provider RECORD;
  v_album_count int;
  v_already boolean;
BEGIN
  SELECT user_id INTO v_provider FROM public.providers WHERE id = NEW.provider_id;
  IF v_provider IS NULL THEN RETURN NEW; END IF;
  v_user_id := v_provider.user_id;

  SELECT COUNT(*) INTO v_album_count FROM public.portfolio_albums
  WHERE provider_id = NEW.provider_id;

  IF v_album_count = 1 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.engagement_log
      WHERE user_id = v_user_id AND action_key = 'onboarding_first_portfolio_album'
    ) INTO v_already;
    IF NOT v_already THEN
      PERFORM public.award_engagement_points(v_user_id, 'onboarding_first_portfolio_album',
        jsonb_build_object('album_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_first_portfolio ON public.portfolio_albums;
CREATE TRIGGER trg_onboarding_first_portfolio
AFTER INSERT ON public.portfolio_albums
FOR EACH ROW
EXECUTE FUNCTION public.trg_award_onboarding_first_portfolio();

-- 7) Sponsor: status default + RLS visitante só vê 'active'
ALTER TABLE public.sponsors ALTER COLUMN status SET DEFAULT 'pending_approval';

DROP POLICY IF EXISTS "Public sees only active sponsors" ON public.sponsors;
CREATE POLICY "Public sees only active sponsors"
  ON public.sponsors FOR SELECT
  USING (status = 'active' OR public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);
