
-- =====================================================================
-- ONBOARDING AUTO-RESPONSE · Incidents + RPCs
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.onboarding_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL DEFAULT 'incident'
    CHECK (state IN ('normal','degraded','incident','recovery','resolved')),
  severity text NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high','critical')),
  trigger_metric text NOT NULL,
  trigger_value numeric,
  baseline_value numeric,
  threshold_value numeric,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  flags_changed jsonb NOT NULL DEFAULT '{}'::jsonb,
  app_version text,
  release_channel text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  duration_seconds integer,
  resolution_kind text,  -- auto | manual | timeout
  resolved_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onb_incidents_open
  ON public.onboarding_incidents (state, opened_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_onb_incidents_metric
  ON public.onboarding_incidents (trigger_metric, opened_at DESC);

ALTER TABLE public.onboarding_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read onboarding_incidents" ON public.onboarding_incidents;
CREATE POLICY "Admins read onboarding_incidents"
  ON public.onboarding_incidents
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Writes acontecem somente via SECURITY DEFINER RPCs abaixo.

-- =====================================================================
-- RPC 1 · auto-resposta: avalia regressões e abre/fecha incidentes
-- =====================================================================
CREATE OR REPLACE FUNCTION public.evaluate_onboarding_auto_response(
  _window_minutes integer DEFAULT 30,
  _debounce_minutes integer DEFAULT 30,
  _auto_resolve_minutes integer DEFAULT 60
)
RETURNS TABLE (
  opened_count integer,
  resolved_count integer,
  skipped_disabled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_now timestamptz := now();
  v_opened integer := 0;
  v_resolved integer := 0;
  v_rec record;
  v_existing uuid;
  v_severity text;
  v_app text;
  v_channel text;
  v_actions jsonb;
BEGIN
  -- Feature flag global ----------------------------------------------------
  SELECT (value::text)::boolean INTO v_enabled
  FROM public.site_settings
  WHERE key = 'onboarding_auto_response_enabled';

  IF NOT COALESCE(v_enabled, false) THEN
    opened_count := 0;
    resolved_count := 0;
    skipped_disabled := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 1) Abrir incidentes com base em regressões recentes -------------------
  FOR v_rec IN
    SELECT
      COALESCE(oe.meta->>'metric','unknown')          AS metric,
      COALESCE(oe.meta->>'severity','medium')         AS severity,
      NULLIF(oe.meta->>'current_value','')::numeric   AS current_value,
      NULLIF(oe.meta->>'baseline_value','')::numeric  AS baseline_value,
      NULLIF(oe.meta->>'threshold_value','')::numeric AS threshold_value,
      COALESCE(oe.meta->>'app_version','')            AS app_version,
      COALESCE(oe.meta->>'release_channel','')        AS release_channel
    FROM public.onboarding_events oe
    WHERE oe.event = 'onboarding_regression_detected'
      AND oe.created_at >= v_now - make_interval(mins => _window_minutes)
  LOOP
    -- Debounce: existe incidente recente para a mesma métrica?
    SELECT id INTO v_existing
    FROM public.onboarding_incidents
    WHERE trigger_metric = v_rec.metric
      AND opened_at >= v_now - make_interval(mins => _debounce_minutes)
    ORDER BY opened_at DESC
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_severity := CASE
      WHEN v_rec.severity IN ('low','medium','high','critical') THEN v_rec.severity
      ELSE 'medium'
    END;

    -- Ações automáticas (descritivas; consumo pela UI é opt-in)
    v_actions := '[]'::jsonb;
    IF v_rec.metric ILIKE 'autosave%fail%' THEN
      v_actions := v_actions || jsonb_build_object('flag','onboarding_remote_draft_enabled','to',false,'reason','autosave_remote_collapse');
    ELSIF v_rec.metric ILIKE 'recovery_corrupt%' OR v_rec.metric ILIKE 'recovery_failed%' THEN
      v_actions := v_actions || jsonb_build_object('flag','onboarding_remote_recovery_enabled','to',false,'reason','recovery_corruption');
    ELSIF v_rec.metric ILIKE 'refresh%' THEN
      v_actions := v_actions || jsonb_build_object('flag','onboarding_local_autosave_boost','to',true,'reason','refresh_spike');
    ELSIF v_rec.metric ILIKE 'completion%' AND v_severity IN ('high','critical') THEN
      v_actions := v_actions || jsonb_build_object('flag','onboarding_recovery_modal_enabled','to',true,'reason','completion_collapse');
    END IF;

    INSERT INTO public.onboarding_incidents (
      state, severity, trigger_metric, trigger_value, baseline_value,
      threshold_value, actions, app_version, release_channel, opened_at
    )
    VALUES (
      CASE WHEN v_severity IN ('high','critical') THEN 'incident' ELSE 'degraded' END,
      v_severity, v_rec.metric, v_rec.current_value, v_rec.baseline_value,
      v_rec.threshold_value, v_actions,
      NULLIF(v_rec.app_version,''), NULLIF(v_rec.release_channel,''),
      v_now
    );

    v_opened := v_opened + 1;
  END LOOP;

  -- 2) Auto-resolver incidentes sem nova regressão na janela --------------
  WITH stale AS (
    SELECT i.id
    FROM public.onboarding_incidents i
    WHERE i.resolved_at IS NULL
      AND i.opened_at <= v_now - make_interval(mins => _auto_resolve_minutes)
      AND NOT EXISTS (
        SELECT 1
        FROM public.onboarding_events oe
        WHERE oe.event = 'onboarding_regression_detected'
          AND COALESCE(oe.meta->>'metric','') = i.trigger_metric
          AND oe.created_at >= v_now - make_interval(mins => _auto_resolve_minutes)
      )
  )
  UPDATE public.onboarding_incidents i
     SET resolved_at      = v_now,
         duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_now - i.opened_at))::int),
         resolution_kind  = 'auto',
         state            = 'resolved'
    FROM stale s
   WHERE i.id = s.id;

  GET DIAGNOSTICS v_resolved = ROW_COUNT;

  opened_count := v_opened;
  resolved_count := v_resolved;
  skipped_disabled := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_onboarding_auto_response(integer,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_onboarding_auto_response(integer,integer,integer) TO authenticated;

-- =====================================================================
-- RPC 2 · admin list incidents
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_list_onboarding_incidents(
  _hours integer DEFAULT 168,
  _only_open boolean DEFAULT false
)
RETURNS SETOF public.onboarding_incidents
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF _hours IS NULL OR _hours < 1 THEN _hours := 168; END IF;
  IF _hours > 24 * 60 THEN _hours := 24 * 60; END IF;

  RETURN QUERY
  SELECT *
  FROM public.onboarding_incidents
  WHERE opened_at >= now() - make_interval(hours => _hours)
    AND (NOT _only_open OR resolved_at IS NULL)
  ORDER BY opened_at DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_onboarding_incidents(integer,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_onboarding_incidents(integer,boolean) TO authenticated;

-- =====================================================================
-- RPC 3 · admin force-resolve incident
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_resolve_onboarding_incident(
  _incident_id uuid,
  _notes text DEFAULT NULL
)
RETURNS public.onboarding_incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.onboarding_incidents;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  UPDATE public.onboarding_incidents
     SET resolved_at      = now(),
         duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - opened_at))::int),
         resolution_kind  = 'manual',
         resolved_by      = auth.uid(),
         state            = 'resolved',
         notes            = COALESCE(_notes, notes)
   WHERE id = _incident_id
     AND resolved_at IS NULL
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'incident_not_found_or_already_resolved';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_onboarding_incident(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_onboarding_incident(uuid,text) TO authenticated;
