
-- =====================================================================
-- ONBOARDING EXPERIMENTATION FRAMEWORK
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.onboarding_experiments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key   text NOT NULL UNIQUE
                     CHECK (experiment_key ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  name             text NOT NULL,
  description      text,
  type             text NOT NULL
                     CHECK (type IN (
                       'copy','label','helper_text','cta_wording',
                       'progress_indicator','visual_order',
                       'spacing_layout','microinteraction'
                     )),
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','running','paused','auto_disabled','completed')),
  rollout_percentage numeric NOT NULL DEFAULT 0
                     CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  variants         jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience         jsonb NOT NULL DEFAULT '{}'::jsonb,
  start_at         timestamptz,
  end_at           timestamptz,
  auto_kill_enabled boolean NOT NULL DEFAULT true,
  last_evaluated_at timestamptz,
  last_kill_reason text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onb_experiments_status ON public.onboarding_experiments(status);
CREATE INDEX IF NOT EXISTS idx_onb_experiments_key ON public.onboarding_experiments(experiment_key);

ALTER TABLE public.onboarding_experiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage experiments" ON public.onboarding_experiments;
CREATE POLICY "admins manage experiments"
ON public.onboarding_experiments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_onb_experiments_updated_at ON public.onboarding_experiments;
CREATE TRIGGER trg_onb_experiments_updated_at
BEFORE UPDATE ON public.onboarding_experiments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.onboarding_experiment_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   uuid NOT NULL REFERENCES public.onboarding_experiments(id) ON DELETE CASCADE,
  experiment_key  text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('baseline','running','final','auto_kill')),
  captured_at     timestamptz NOT NULL DEFAULT now(),
  rollout_reached numeric NOT NULL DEFAULT 0,
  status_at_capture text NOT NULL,
  variants        jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_onb_exp_snap_exp_captured
  ON public.onboarding_experiment_snapshots(experiment_id, captured_at DESC);

ALTER TABLE public.onboarding_experiment_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read experiment snapshots" ON public.onboarding_experiment_snapshots;
CREATE POLICY "admins read experiment snapshots"
ON public.onboarding_experiment_snapshots
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins insert experiment snapshots" ON public.onboarding_experiment_snapshots;
CREATE POLICY "admins insert experiment snapshots"
ON public.onboarding_experiment_snapshots
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.site_settings (key, value, description, is_public)
VALUES
  ('onboarding_experiments_enabled', 'false'::jsonb,
   'Master switch do framework de experimentos do onboarding.', false),
  ('onboarding_experiments_auto_kill_enabled', 'true'::jsonb,
   'Permite que o motor pause experimentos com degradação severa.', false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_list_onboarding_experiments()
RETURNS SETOF public.onboarding_experiments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT * FROM public.onboarding_experiments
    ORDER BY
      CASE status WHEN 'running' THEN 0 WHEN 'paused' THEN 1
                  WHEN 'auto_disabled' THEN 2 WHEN 'draft' THEN 3
                  ELSE 4 END,
      updated_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_experiment_variant_metrics(
  _experiment_key text, _hours integer DEFAULT 24
)
RETURNS TABLE (
  variant_id text, units_assigned bigint, enters bigint, completes bigint,
  abandons bigint, refreshes bigint, recoveries bigint,
  validation_failed bigint, rage_clicks bigint, hesitations bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  WITH base AS (
    SELECT
      COALESCE(meta->>'experiment_variant_id', meta->>'variant_id') AS vid,
      session_id, event
    FROM public.onboarding_events
    WHERE created_at >= now() - make_interval(hours => GREATEST(1, LEAST(_hours, 720)))
      AND (meta->>'experiment_key') = _experiment_key
      AND COALESCE(meta->>'experiment_variant_id', meta->>'variant_id') IS NOT NULL
  )
  SELECT
    vid AS variant_id,
    COUNT(DISTINCT session_id)::bigint AS units_assigned,
    COUNT(*) FILTER (WHERE event = 'phase_enter')::bigint AS enters,
    COUNT(*) FILTER (WHERE event IN ('onboarding_complete','complete'))::bigint AS completes,
    COUNT(*) FILTER (WHERE event = 'abandon')::bigint AS abandons,
    COUNT(*) FILTER (WHERE event = 'refresh')::bigint AS refreshes,
    COUNT(*) FILTER (WHERE event IN ('recovery','recovered'))::bigint AS recoveries,
    COUNT(*) FILTER (WHERE event = 'validation_failed')::bigint AS validation_failed,
    COUNT(*) FILTER (WHERE event = 'rage_click')::bigint AS rage_clicks,
    COUNT(*) FILTER (WHERE event = 'hesitation')::bigint AS hesitations
  FROM base
  GROUP BY vid
  ORDER BY 2 DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_onboarding_experiment(
  _experiment_key text, _name text, _type text, _rollout_percentage numeric,
  _variants jsonb, _audience jsonb DEFAULT '{}'::jsonb,
  _description text DEFAULT NULL, _start_at timestamptz DEFAULT NULL,
  _end_at timestamptz DEFAULT NULL, _auto_kill_enabled boolean DEFAULT true
) RETURNS public.onboarding_experiments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec public.onboarding_experiments; has_control boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _type NOT IN ('copy','label','helper_text','cta_wording','progress_indicator','visual_order','spacing_layout','microinteraction') THEN
    RAISE EXCEPTION 'type_not_in_safe_whitelist';
  END IF;
  IF jsonb_array_length(_variants) < 2 THEN RAISE EXCEPTION 'variants_min_2'; END IF;
  IF jsonb_array_length(_variants) > 6 THEN RAISE EXCEPTION 'variants_max_6'; END IF;
  SELECT bool_or(COALESCE((v->>'isControl')::boolean, false)) INTO has_control
    FROM jsonb_array_elements(_variants) v;
  IF NOT COALESCE(has_control, false) THEN RAISE EXCEPTION 'control_required'; END IF;

  INSERT INTO public.onboarding_experiments
    (experiment_key, name, description, type, rollout_percentage,
     variants, audience, start_at, end_at, auto_kill_enabled, created_by)
  VALUES
    (_experiment_key, _name, _description, _type, _rollout_percentage,
     _variants, COALESCE(_audience, '{}'::jsonb), _start_at, _end_at,
     COALESCE(_auto_kill_enabled, true), auth.uid())
  ON CONFLICT (experiment_key) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    type = EXCLUDED.type, rollout_percentage = EXCLUDED.rollout_percentage,
    variants = EXCLUDED.variants, audience = EXCLUDED.audience,
    start_at = EXCLUDED.start_at, end_at = EXCLUDED.end_at,
    auto_kill_enabled = EXCLUDED.auto_kill_enabled, updated_at = now()
  RETURNING * INTO rec;
  RETURN rec;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_onboarding_experiment_status(
  _experiment_key text, _status text, _reason text DEFAULT NULL
) RETURNS public.onboarding_experiments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec public.onboarding_experiments;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('draft','running','paused','auto_disabled','completed') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  UPDATE public.onboarding_experiments
     SET status = _status,
         last_kill_reason = CASE WHEN _status='auto_disabled' THEN _reason ELSE last_kill_reason END,
         updated_at = now()
   WHERE experiment_key = _experiment_key
   RETURNING * INTO rec;
  IF rec.id IS NULL THEN RAISE EXCEPTION 'experiment_not_found'; END IF;
  BEGIN
    INSERT INTO public.system_audit_logs (actor_id, action, target_table, target_id, meta)
    VALUES (auth.uid(), 'onboarding_experiment_status', 'onboarding_experiments', rec.id,
            jsonb_build_object('experiment_key', _experiment_key, 'status', _status, 'reason', _reason));
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  RETURN rec;
END $$;

CREATE OR REPLACE FUNCTION public.admin_capture_onboarding_experiment_snapshot(
  _experiment_key text, _kind text DEFAULT 'running', _hours integer DEFAULT 24
) RETURNS public.onboarding_experiment_snapshots
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  exp public.onboarding_experiments; variants_json jsonb;
  snap public.onboarding_experiment_snapshots;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _kind NOT IN ('baseline','running','final','auto_kill') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
  SELECT * INTO exp FROM public.onboarding_experiments WHERE experiment_key = _experiment_key;
  IF exp.id IS NULL THEN RAISE EXCEPTION 'experiment_not_found'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) INTO variants_json
    FROM public.admin_experiment_variant_metrics(_experiment_key, _hours) m;
  INSERT INTO public.onboarding_experiment_snapshots
    (experiment_id, experiment_key, kind, rollout_reached,
     status_at_capture, variants, meta)
  VALUES
    (exp.id, _experiment_key, _kind, exp.rollout_percentage,
     exp.status, variants_json,
     jsonb_build_object('window_hours', _hours, 'captured_by', auth.uid()))
  RETURNING * INTO snap;
  RETURN snap;
END $$;

CREATE OR REPLACE FUNCTION public.evaluate_onboarding_experiments_kill_switch()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  enabled boolean; exp public.onboarding_experiments;
  metrics jsonb; control jsonb; variant jsonb;
  cv_enters numeric; cv_completes numeric; cv_abandons numeric; cv_units numeric;
  vv_enters numeric; vv_completes numeric; vv_abandons numeric; vv_units numeric;
  vv_validation numeric; cv_validation numeric;
  completion_drop_pp numeric; abandon_rise_pp numeric;
  reasons text[]; disabled_keys text[] := ARRAY[]::text[];
BEGIN
  SELECT (value)::boolean INTO enabled
    FROM public.site_settings WHERE key = 'onboarding_experiments_auto_kill_enabled';
  IF NOT COALESCE(enabled, false) THEN
    RETURN jsonb_build_object('disabled_count', 0, 'reason', 'auto_kill_off');
  END IF;

  FOR exp IN
    SELECT * FROM public.onboarding_experiments WHERE status = 'running' AND auto_kill_enabled
  LOOP
    SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) INTO metrics
      FROM public.admin_experiment_variant_metrics(exp.experiment_key, 2) m;

    SELECT m INTO control
      FROM jsonb_array_elements(metrics) m
      JOIN jsonb_array_elements(exp.variants) v ON v->>'id' = m->>'variant_id'
     WHERE COALESCE((v->>'isControl')::boolean, false) = true
     LIMIT 1;

    IF control IS NULL THEN CONTINUE; END IF;
    cv_units    := COALESCE((control->>'units_assigned')::numeric, 0);
    cv_enters   := COALESCE((control->>'enters')::numeric, 0);
    cv_completes:= COALESCE((control->>'completes')::numeric, 0);
    cv_abandons := COALESCE((control->>'abandons')::numeric, 0);
    cv_validation := COALESCE((control->>'validation_failed')::numeric, 0);

    FOR variant IN
      SELECT m FROM jsonb_array_elements(metrics) m
       WHERE (m->>'variant_id') <> (control->>'variant_id')
    LOOP
      vv_units     := COALESCE((variant->>'units_assigned')::numeric, 0);
      vv_enters    := COALESCE((variant->>'enters')::numeric, 0);
      vv_completes := COALESCE((variant->>'completes')::numeric, 0);
      vv_abandons  := COALESCE((variant->>'abandons')::numeric, 0);
      vv_validation:= COALESCE((variant->>'validation_failed')::numeric, 0);

      IF vv_units < 200 THEN CONTINUE; END IF;

      reasons := ARRAY[]::text[];
      IF cv_enters > 0 AND vv_enters > 0 THEN
        completion_drop_pp := (cv_completes/cv_enters - vv_completes/vv_enters) * 100;
        abandon_rise_pp    := (vv_abandons/vv_enters - cv_abandons/cv_enters) * 100;
        IF completion_drop_pp >= 15 THEN reasons := array_append(reasons, 'completion_collapse'); END IF;
        IF abandon_rise_pp    >= 15 THEN reasons := array_append(reasons, 'abandonment_spike'); END IF;
      END IF;
      IF cv_validation > 0 AND ((vv_validation - cv_validation)/cv_validation)*100 >= 50 THEN
        reasons := array_append(reasons, 'validation_explosion');
      END IF;

      IF array_length(reasons, 1) IS NOT NULL THEN
        UPDATE public.onboarding_experiments
           SET status='auto_disabled',
               last_kill_reason = array_to_string(reasons || ARRAY['variant:'||(variant->>'variant_id')], ','),
               last_evaluated_at = now(), updated_at = now()
         WHERE id = exp.id;
        BEGIN
          PERFORM public.admin_capture_onboarding_experiment_snapshot(exp.experiment_key, 'auto_kill', 2);
        EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN
          INSERT INTO public.onboarding_events (event, phase, session_id, meta)
          VALUES ('experiment_auto_disabled', NULL, gen_random_uuid()::text,
                  jsonb_build_object('experiment_key', exp.experiment_key,
                                     'variant_id', variant->>'variant_id',
                                     'reasons', reasons));
        EXCEPTION WHEN OTHERS THEN NULL; END;
        disabled_keys := array_append(disabled_keys, exp.experiment_key);
        EXIT;
      END IF;
    END LOOP;

    UPDATE public.onboarding_experiments SET last_evaluated_at = now() WHERE id = exp.id;
  END LOOP;

  RETURN jsonb_build_object(
    'disabled_count', COALESCE(array_length(disabled_keys,1),0),
    'disabled_keys', to_jsonb(disabled_keys));
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'onboarding-experiments-eval') THEN
      PERFORM cron.unschedule('onboarding-experiments-eval');
    END IF;
    PERFORM cron.schedule(
      'onboarding-experiments-eval', '*/10 * * * *',
      $cron$ SELECT public.evaluate_onboarding_experiments_kill_switch(); $cron$);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
