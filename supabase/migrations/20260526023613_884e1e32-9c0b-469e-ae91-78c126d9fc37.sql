
CREATE OR REPLACE FUNCTION public.admin_onboarding_behavioral_summary(
  _hours int DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - make_interval(hours => GREATEST(1, LEAST(_hours, 168)));
  v_phases jsonb;
  v_devices jsonb;
  v_sources jsonb;
  v_releases jsonb;
  v_fields jsonb;
  v_chains jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- ============================================================
  -- Hotspots por fase
  -- ============================================================
  WITH base AS (
    SELECT
      COALESCE(phase, meta->>'phase', 'unknown') AS phase,
      event
    FROM public.onboarding_events
    WHERE created_at >= v_since
  )
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO v_phases
  FROM (
    SELECT jsonb_build_object(
      'phase', phase,
      'enters', count(*) FILTER (WHERE event = 'enter'),
      'completes', count(*) FILTER (WHERE event = 'complete'),
      'abandons', count(*) FILTER (WHERE event = 'abandon'),
      'refreshes', count(*) FILTER (WHERE event = 'refresh'),
      'hesitations', count(*) FILTER (WHERE event = 'hesitation_detected'),
      'rage_clicks', count(*) FILTER (WHERE event = 'rage_click_detected'),
      'repeated_validations', count(*) FILTER (WHERE event = 'repeated_validation_error'),
      'multi_submits', count(*) FILTER (WHERE event = 'multi_attempt_submit')
    ) AS row
    FROM base
    GROUP BY phase
    ORDER BY phase
  ) t;

  -- ============================================================
  -- Segmentação por device
  -- ============================================================
  WITH base AS (
    SELECT
      COALESCE(meta->>'device', 'unknown') AS seg,
      event
    FROM public.onboarding_events
    WHERE created_at >= v_since
  )
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO v_devices
  FROM (
    SELECT jsonb_build_object(
      'segment', seg,
      'enters', count(*) FILTER (WHERE event = 'enter'),
      'completes', count(*) FILTER (WHERE event = 'complete'),
      'abandons', count(*) FILTER (WHERE event = 'abandon'),
      'hesitations', count(*) FILTER (WHERE event = 'hesitation_detected'),
      'rage_clicks', count(*) FILTER (WHERE event = 'rage_click_detected'),
      'repeated_validations', count(*) FILTER (WHERE event = 'repeated_validation_error'),
      'refreshes', count(*) FILTER (WHERE event = 'refresh')
    ) AS row
    FROM base
    GROUP BY seg
    ORDER BY count(*) FILTER (WHERE event = 'enter') DESC
  ) t;

  -- Source
  WITH base AS (
    SELECT
      COALESCE(meta->>'source', meta->>'draft_source', 'unknown') AS seg,
      event
    FROM public.onboarding_events
    WHERE created_at >= v_since
  )
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO v_sources
  FROM (
    SELECT jsonb_build_object(
      'segment', seg,
      'enters', count(*) FILTER (WHERE event = 'enter'),
      'completes', count(*) FILTER (WHERE event = 'complete'),
      'abandons', count(*) FILTER (WHERE event = 'abandon')
    ) AS row
    FROM base
    GROUP BY seg
    ORDER BY count(*) FILTER (WHERE event = 'enter') DESC
    LIMIT 20
  ) t;

  -- Release
  WITH base AS (
    SELECT
      COALESCE(meta->>'app_version', 'unknown') AS seg,
      event
    FROM public.onboarding_events
    WHERE created_at >= v_since
  )
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO v_releases
  FROM (
    SELECT jsonb_build_object(
      'segment', seg,
      'enters', count(*) FILTER (WHERE event = 'enter'),
      'completes', count(*) FILTER (WHERE event = 'complete'),
      'abandons', count(*) FILTER (WHERE event = 'abandon')
    ) AS row
    FROM base
    GROUP BY seg
    ORDER BY count(*) FILTER (WHERE event = 'enter') DESC
    LIMIT 20
  ) t;

  -- ============================================================
  -- Campos mais problemáticos
  -- ============================================================
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO v_fields
  FROM (
    SELECT jsonb_build_object(
      'field', meta->>'field',
      'hesitations', count(*) FILTER (WHERE event = 'hesitation_detected'),
      'rage_clicks', count(*) FILTER (WHERE event = 'rage_click_detected'),
      'repeated_validations', count(*) FILTER (WHERE event = 'repeated_validation_error'),
      'multi_submits', count(*) FILTER (WHERE event = 'multi_attempt_submit'),
      'total', count(*)
    ) AS row
    FROM public.onboarding_events
    WHERE created_at >= v_since
      AND meta ? 'field'
      AND event IN ('hesitation_detected','rage_click_detected','repeated_validation_error','multi_attempt_submit','field_time_spent')
    GROUP BY meta->>'field'
    ORDER BY count(*) DESC
    LIMIT 20
  ) t;

  -- ============================================================
  -- Padrões de abandono · top 5 (últimos 3 eventos antes de sair)
  -- ============================================================
  WITH ordered AS (
    SELECT
      session_id,
      event,
      COALESCE(phase, meta->>'phase') AS phase,
      created_at,
      row_number() OVER (PARTITION BY session_id ORDER BY created_at DESC) AS rn,
      bool_or(event = 'complete') OVER (PARTITION BY session_id) AS has_complete
    FROM public.onboarding_events
    WHERE created_at >= v_since
      AND session_id IS NOT NULL
  ),
  last3 AS (
    SELECT
      session_id,
      string_agg(event, ' → ' ORDER BY rn DESC) AS pattern,
      max(phase) FILTER (WHERE rn = 1) AS exit_phase
    FROM ordered
    WHERE has_complete = false AND rn <= 3
    GROUP BY session_id
  )
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO v_chains
  FROM (
    SELECT jsonb_build_object(
      'pattern', COALESCE(exit_phase,'?') || ' ⇠ ' || pattern,
      'count', count(*)
    ) AS row
    FROM last3
    GROUP BY exit_phase, pattern
    ORDER BY count(*) DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'window_hours', _hours,
    'computed_at', now(),
    'phases', v_phases,
    'devices', v_devices,
    'sources', v_sources,
    'releases', v_releases,
    'fields', v_fields,
    'abandonment_patterns', v_chains
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_onboarding_behavioral_summary(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_behavioral_summary(int) TO authenticated;
