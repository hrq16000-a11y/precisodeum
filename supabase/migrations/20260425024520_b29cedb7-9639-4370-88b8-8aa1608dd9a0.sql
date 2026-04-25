-- =====================================================================
-- 1) user_dashboard_state: persistência de visitas e widgets dispensados
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_dashboard_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  visits_count integer NOT NULL DEFAULT 0,
  last_visit_at timestamptz,
  first_visit_at timestamptz NOT NULL DEFAULT now(),
  dismissed_widgets text[] NOT NULL DEFAULT '{}'::text[],
  preferred_tier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_dashboard_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dashboard state"
  ON public.user_dashboard_state FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own dashboard state"
  ON public.user_dashboard_state FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own dashboard state"
  ON public.user_dashboard_state FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all dashboard state"
  ON public.user_dashboard_state FOR SELECT
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_user_dashboard_state_updated
  BEFORE UPDATE ON public.user_dashboard_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC para registrar visita atomicamente
CREATE OR REPLACE FUNCTION public.register_dashboard_visit()
RETURNS public.user_dashboard_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result public.user_dashboard_state;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  INSERT INTO public.user_dashboard_state (user_id, visits_count, last_visit_at)
  VALUES (uid, 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET visits_count = public.user_dashboard_state.visits_count + 1,
        last_visit_at = now(),
        updated_at = now()
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- RPC dismiss widget
CREATE OR REPLACE FUNCTION public.dismiss_dashboard_widget(_widget text)
RETURNS public.user_dashboard_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result public.user_dashboard_state;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  -- Lista de widgets imutáveis (NUNCA podem ser dispensados)
  IF _widget IN ('online_status','presence','availability') THEN
    RAISE EXCEPTION 'widget % is immutable', _widget;
  END IF;
  INSERT INTO public.user_dashboard_state (user_id, dismissed_widgets)
  VALUES (uid, ARRAY[_widget])
  ON CONFLICT (user_id) DO UPDATE
    SET dismissed_widgets = (
      SELECT array_agg(DISTINCT w) FROM unnest(
        public.user_dashboard_state.dismissed_widgets || ARRAY[_widget]
      ) w
    ),
    updated_at = now()
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- RPC restore widget
CREATE OR REPLACE FUNCTION public.restore_dashboard_widget(_widget text)
RETURNS public.user_dashboard_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result public.user_dashboard_state;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.user_dashboard_state
    SET dismissed_widgets = array_remove(dismissed_widgets, _widget),
        updated_at = now()
    WHERE user_id = uid
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- =====================================================================
-- 2) Maturity tier RPC
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_user_maturity_tier(_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := COALESCE(_user_id, auth.uid());
  v_visits int := 0;
  v_engagement int := 0;
  v_checkins int := 0;
  v_step int := 1;
  v_completed boolean := false;
  v_tier text := 'novato';
  v_score int := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('tier','novato','score',0,'visits',0,'engagement',0,'checkins',0);
  END IF;

  SELECT COALESCE(visits_count,0) INTO v_visits
    FROM public.user_dashboard_state WHERE user_id = uid;

  SELECT COALESCE(engagement_points,0), COALESCE(onboarding_step,1), COALESCE(onboarding_completed,false)
    INTO v_engagement, v_step, v_completed
    FROM public.profiles WHERE id = uid;

  -- daily_checkins (se existir)
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public.daily_checkins WHERE user_id = $1' INTO v_checkins USING uid;
  EXCEPTION WHEN undefined_table THEN v_checkins := 0;
  END;

  -- Score composto (0-100)
  v_score := LEAST(100,
      (LEAST(v_visits, 30) * 1)            -- até 30 pts por visitas
    + (LEAST(v_engagement / 20, 30))       -- até 30 pts por engajamento
    + (LEAST(v_checkins * 3, 20))          -- até 20 pts por check-ins
    + (CASE WHEN v_completed THEN 20 ELSE v_step * 3 END) -- até 20 pts onboarding
  );

  v_tier := CASE
    WHEN v_score >= 75 THEN 'veterano'
    WHEN v_score >= 45 THEN 'ativo'
    WHEN v_score >= 20 THEN 'explorador'
    ELSE 'novato'
  END;

  RETURN jsonb_build_object(
    'tier', v_tier,
    'score', v_score,
    'visits', v_visits,
    'engagement', v_engagement,
    'checkins', v_checkins,
    'onboarding_step', v_step,
    'onboarding_completed', v_completed
  );
END;
$$;

-- =====================================================================
-- 3) Sync triggers bidirecional (DADOS OPERACIONAIS apenas)
--    Operacionais = city, state, category_id, lat, lng (whatsapp/phone)
--    Identidade   = full_name, tax_id  → NÃO sincroniza, gera SUGESTÃO
--    Guarda anti-loop via session GUC
-- =====================================================================

-- Tabela de sugestões para campos de identidade (não sobrescreve sozinho)
CREATE TABLE IF NOT EXISTS public.profile_change_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field text NOT NULL,
  suggested_value text NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.profile_change_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User reads own suggestions"
  ON public.profile_change_suggestions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "User updates own suggestions"
  ON public.profile_change_suggestions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_profile_suggestions_user_pending
  ON public.profile_change_suggestions(user_id) WHERE status = 'pending';

-- Função guard: define flag para evitar loop entre triggers
CREATE OR REPLACE FUNCTION public._sync_in_progress()
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  RETURN COALESCE(current_setting('app.sync_in_progress', true), '') = 'on';
END; $$;

-- Trigger: provider mudou → propaga city/state/category para services do mesmo provider
-- e para profile (operacional)
CREATE OR REPLACE FUNCTION public.sync_provider_to_related()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public._sync_in_progress() THEN RETURN NEW; END IF;
  PERFORM set_config('app.sync_in_progress','on', true);

  -- profile (apenas city/state se mudaram)
  IF (NEW.city IS DISTINCT FROM OLD.city) OR (NEW.state IS DISTINCT FROM OLD.state) THEN
    UPDATE public.profiles
       SET city = COALESCE(NULLIF(NEW.city,''), city),
           state = COALESCE(NULLIF(NEW.state,''), state),
           updated_at = now()
     WHERE id = NEW.user_id;
  END IF;

  PERFORM set_config('app.sync_in_progress','off', true);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_provider_to_related ON public.providers;
CREATE TRIGGER trg_sync_provider_to_related
  AFTER UPDATE OF city, state, category_id ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.sync_provider_to_related();

-- Trigger: service mudou → propaga category_id para provider (se provider sem categoria)
-- e propaga endereço/cidade implícita do service para provider quando provider está vazio
CREATE OR REPLACE FUNCTION public.sync_service_to_provider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_provider record;
BEGIN
  IF public._sync_in_progress() THEN RETURN NEW; END IF;
  IF NEW.provider_id IS NULL THEN RETURN NEW; END IF;

  PERFORM set_config('app.sync_in_progress','on', true);

  SELECT id, user_id, city, state, category_id INTO v_provider
    FROM public.providers WHERE id = NEW.provider_id;

  IF v_provider.id IS NOT NULL THEN
    -- Categoria: sincroniza sempre que service tem e provider está sem
    IF NEW.category_id IS NOT NULL AND v_provider.category_id IS NULL THEN
      UPDATE public.providers SET category_id = NEW.category_id, updated_at = now()
        WHERE id = v_provider.id;
    END IF;
  END IF;

  PERFORM set_config('app.sync_in_progress','off', true);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_service_to_provider ON public.services;
CREATE TRIGGER trg_sync_service_to_provider
  AFTER INSERT OR UPDATE OF category_id, address, service_area ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.sync_service_to_provider();

-- Trigger: profile mudou (city/state) → propaga para provider do mesmo user
CREATE OR REPLACE FUNCTION public.sync_profile_to_provider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public._sync_in_progress() THEN RETURN NEW; END IF;

  IF (NEW.city IS DISTINCT FROM OLD.city) OR (NEW.state IS DISTINCT FROM OLD.state) THEN
    PERFORM set_config('app.sync_in_progress','on', true);
    UPDATE public.providers
       SET city = COALESCE(NULLIF(NEW.city,''), city),
           state = COALESCE(NULLIF(NEW.state,''), state),
           updated_at = now()
     WHERE user_id = NEW.id;
    PERFORM set_config('app.sync_in_progress','off', true);
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_provider ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_provider
  AFTER UPDATE OF city, state ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_provider();