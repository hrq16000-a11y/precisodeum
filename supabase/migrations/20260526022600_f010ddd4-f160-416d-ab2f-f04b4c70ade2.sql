
-- ============================================================
-- Onboarding Release Gatekeeper
-- ============================================================

CREATE TABLE IF NOT EXISTS public.onboarding_release_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  app_version text,
  release_channel text NOT NULL DEFAULT 'production',
  stage text NOT NULL DEFAULT 'production', -- canary | staging | production
  window_hours int NOT NULL DEFAULT 24,
  health_score int NOT NULL,
  classification text NOT NULL, -- SAFE | WARNING | DEGRADED | BLOCKED
  blocked boolean NOT NULL DEFAULT false,
  block_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  open_regressions int NOT NULL DEFAULT 0,
  critical_regressions int NOT NULL DEFAULT 0,
  open_incidents int NOT NULL DEFAULT 0,
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_release_snapshots_captured ON public.onboarding_release_snapshots (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_snapshots_stage_version ON public.onboarding_release_snapshots (stage, app_version);

ALTER TABLE public.onboarding_release_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin select release snapshots"
  ON public.onboarding_release_snapshots FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin insert release snapshots"
  ON public.onboarding_release_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Feature flag (opt-in)
INSERT INTO public.site_settings (key, value, description)
VALUES (
  'onboarding_release_gatekeeper_enabled',
  'false'::jsonb,
  'Habilita o Release Gatekeeper para snapshots e bloqueios pré-deploy do onboarding.'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- RPC: compute_onboarding_release_health
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_onboarding_release_health(
  _hours int DEFAULT 24,
  _channel text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - make_interval(hours => GREATEST(1, LEAST(_hours, 168)));
  v_enters int := 0;
  v_completes int := 0;
  v_abandons int := 0;
  v_refreshes int := 0;
  v_validation_fail int := 0;
  v_autosave_fail int := 0;
  v_recovery_corruption int := 0;
  v_zombie_timer int := 0;
  v_open_regressions int := 0;
  v_critical_regressions int := 0;
  v_open_incidents int := 0;
  v_completion_rate numeric := 0;
  v_abandon_rate numeric := 0;
  v_refresh_rate numeric := 0;
  v_score int := 100;
  v_reasons jsonb := '[]'::jsonb;
  v_blocked boolean := false;
  v_class text := 'SAFE';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    count(*) FILTER (WHERE event = 'enter'),
    count(*) FILTER (WHERE event = 'complete'),
    count(*) FILTER (WHERE event = 'abandon'),
    count(*) FILTER (WHERE event = 'refresh'),
    count(*) FILTER (WHERE event ILIKE 'validation_fail%'),
    count(*) FILTER (WHERE event ILIKE 'autosave_fail%'),
    count(*) FILTER (WHERE event ILIKE 'recovery_corruption%'),
    count(*) FILTER (WHERE event ILIKE '%zombie_timer%')
  INTO
    v_enters, v_completes, v_abandons, v_refreshes,
    v_validation_fail, v_autosave_fail, v_recovery_corruption, v_zombie_timer
  FROM public.onboarding_events
  WHERE created_at >= v_since
    AND (_channel IS NULL OR (meta->>'release_channel') = _channel);

  SELECT
    count(*),
    count(*) FILTER (WHERE COALESCE(meta->>'severity','low') IN ('high','critical'))
  INTO v_open_regressions, v_critical_regressions
  FROM public.onboarding_events
  WHERE event = 'onboarding_regression_detected'
    AND created_at >= v_since;

  BEGIN
    SELECT count(*) INTO v_open_incidents
    FROM public.onboarding_incidents
    WHERE resolved_at IS NULL;
  EXCEPTION WHEN undefined_table THEN
    v_open_incidents := 0;
  END;

  IF v_enters > 0 THEN
    v_completion_rate := round((v_completes::numeric / v_enters::numeric) * 100, 2);
    v_abandon_rate := round((v_abandons::numeric / v_enters::numeric) * 100, 2);
    v_refresh_rate := round((v_refreshes::numeric / v_enters::numeric) * 100, 2);
  END IF;

  -- Penalidades graduais
  IF v_enters >= 20 AND v_completion_rate < 40 THEN
    v_score := v_score - 35;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code','completion_collapse','value',v_completion_rate));
    v_blocked := true;
  ELSIF v_enters >= 20 AND v_completion_rate < 60 THEN
    v_score := v_score - 15;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code','completion_low','value',v_completion_rate));
  END IF;

  IF v_enters >= 20 AND v_abandon_rate > 50 THEN
    v_score := v_score - 15;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code','abandon_high','value',v_abandon_rate));
  END IF;

  IF v_autosave_fail >= 10 THEN
    v_score := v_score - 20;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code','autosave_fail_spike','value',v_autosave_fail));
    IF v_autosave_fail >= 25 THEN v_blocked := true; END IF;
  END IF;

  IF v_recovery_corruption >= 3 THEN
    v_score := v_score - 25;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code','recovery_corruption','value',v_recovery_corruption));
    v_blocked := true;
  END IF;

  IF v_critical_regressions > 0 THEN
    v_score := v_score - 25;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code','critical_regressions_open','value',v_critical_regressions));
    v_blocked := true;
  ELSIF v_open_regressions >= 3 THEN
    v_score := v_score - 10;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code','regressions_open','value',v_open_regressions));
  END IF;

  IF v_open_incidents > 0 THEN
    v_score := v_score - 15;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code','incident_open','value',v_open_incidents));
    v_blocked := true;
  END IF;

  IF v_zombie_timer >= 5 THEN
    v_score := v_score - 5;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code','zombie_timer','value',v_zombie_timer));
  END IF;

  v_score := GREATEST(0, LEAST(100, v_score));

  IF v_blocked OR v_score < 50 THEN
    v_class := 'BLOCKED';
    v_blocked := true;
  ELSIF v_score < 70 THEN
    v_class := 'DEGRADED';
  ELSIF v_score < 85 THEN
    v_class := 'WARNING';
  ELSE
    v_class := 'SAFE';
  END IF;

  RETURN jsonb_build_object(
    'window_hours', _hours,
    'channel', _channel,
    'computed_at', now(),
    'health_score', v_score,
    'classification', v_class,
    'blocked', v_blocked,
    'block_reasons', v_reasons,
    'open_regressions', v_open_regressions,
    'critical_regressions', v_critical_regressions,
    'open_incidents', v_open_incidents,
    'metrics', jsonb_build_object(
      'enters', v_enters,
      'completes', v_completes,
      'abandons', v_abandons,
      'refreshes', v_refreshes,
      'validation_fail', v_validation_fail,
      'autosave_fail', v_autosave_fail,
      'recovery_corruption', v_recovery_corruption,
      'zombie_timer', v_zombie_timer,
      'completion_rate', v_completion_rate,
      'abandon_rate', v_abandon_rate,
      'refresh_rate', v_refresh_rate
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_onboarding_release_health(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_onboarding_release_health(int, text) TO authenticated;

-- ============================================================
-- RPC: create_onboarding_release_snapshot
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_onboarding_release_snapshot(
  _app_version text DEFAULT NULL,
  _channel text DEFAULT 'production',
  _stage text DEFAULT 'production',
  _hours int DEFAULT 24,
  _notes text DEFAULT NULL
)
RETURNS public.onboarding_release_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_health jsonb;
  v_flags jsonb := '{}'::jsonb;
  v_row public.onboarding_release_snapshots;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_health := public.compute_onboarding_release_health(_hours, _channel);

  SELECT COALESCE(
    jsonb_object_agg(key, value),
    '{}'::jsonb
  ) INTO v_flags
  FROM public.site_settings
  WHERE key LIKE 'onboarding\_%' ESCAPE '\';

  INSERT INTO public.onboarding_release_snapshots (
    app_version, release_channel, stage, window_hours,
    health_score, classification, blocked, block_reasons,
    metrics, open_regressions, critical_regressions, open_incidents,
    flags, notes, created_by
  ) VALUES (
    _app_version,
    COALESCE(_channel, 'production'),
    COALESCE(_stage, 'production'),
    _hours,
    (v_health->>'health_score')::int,
    v_health->>'classification',
    (v_health->>'blocked')::boolean,
    COALESCE(v_health->'block_reasons','[]'::jsonb),
    COALESCE(v_health->'metrics','{}'::jsonb),
    COALESCE((v_health->>'open_regressions')::int, 0),
    COALESCE((v_health->>'critical_regressions')::int, 0),
    COALESCE((v_health->>'open_incidents')::int, 0),
    v_flags,
    _notes,
    auth.uid()
  ) RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_onboarding_release_snapshot(text, text, text, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_onboarding_release_snapshot(text, text, text, int, text) TO authenticated;

-- ============================================================
-- RPC: list_onboarding_release_snapshots
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_onboarding_release_snapshots(
  _limit int DEFAULT 50,
  _stage text DEFAULT NULL
)
RETURNS SETOF public.onboarding_release_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT * FROM public.onboarding_release_snapshots
  WHERE (_stage IS NULL OR stage = _stage)
  ORDER BY captured_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
END;
$$;

REVOKE ALL ON FUNCTION public.list_onboarding_release_snapshots(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_onboarding_release_snapshots(int, text) TO authenticated;

-- ============================================================
-- RPC: compare_onboarding_release_snapshots
-- ============================================================
CREATE OR REPLACE FUNCTION public.compare_onboarding_release_snapshots(
  _a uuid,
  _b uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.onboarding_release_snapshots;
  b public.onboarding_release_snapshots;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO a FROM public.onboarding_release_snapshots WHERE id = _a;
  SELECT * INTO b FROM public.onboarding_release_snapshots WHERE id = _b;
  IF a IS NULL OR b IS NULL THEN
    RAISE EXCEPTION 'snapshot_not_found';
  END IF;

  RETURN jsonb_build_object(
    'baseline', to_jsonb(a),
    'candidate', to_jsonb(b),
    'delta', jsonb_build_object(
      'health_score', b.health_score - a.health_score,
      'open_regressions', b.open_regressions - a.open_regressions,
      'critical_regressions', b.critical_regressions - a.critical_regressions,
      'open_incidents', b.open_incidents - a.open_incidents,
      'completion_rate',
        COALESCE((b.metrics->>'completion_rate')::numeric,0) -
        COALESCE((a.metrics->>'completion_rate')::numeric,0),
      'abandon_rate',
        COALESCE((b.metrics->>'abandon_rate')::numeric,0) -
        COALESCE((a.metrics->>'abandon_rate')::numeric,0),
      'autosave_fail',
        COALESCE((b.metrics->>'autosave_fail')::numeric,0) -
        COALESCE((a.metrics->>'autosave_fail')::numeric,0),
      'recovery_corruption',
        COALESCE((b.metrics->>'recovery_corruption')::numeric,0) -
        COALESCE((a.metrics->>'recovery_corruption')::numeric,0)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compare_onboarding_release_snapshots(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compare_onboarding_release_snapshots(uuid, uuid) TO authenticated;
