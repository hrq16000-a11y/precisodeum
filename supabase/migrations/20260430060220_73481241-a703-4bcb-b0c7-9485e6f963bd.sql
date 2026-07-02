-- Admin RPC: stats de conclusão do onboarding por origem (gps/cep/manual/ip)
-- e taxa de "travamento" por etapa (entradas vs. submissões com sucesso).
CREATE OR REPLACE FUNCTION public.admin_onboarding_stats(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _since timestamptz := now() - make_interval(days => greatest(1, least(_days, 180)));
  _by_source jsonb;
  _phase_funnel jsonb;
  _stuck jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Conclusão por origem da localização (lida do meta.location_source no
  -- evento submit da fase pro_location e em location_telemetry).
  WITH submits AS (
    SELECT
      COALESCE(NULLIF(meta->>'location_source',''), NULLIF(meta->>'source',''), 'unknown') AS source,
      session_id,
      user_id,
      event,
      phase
    FROM public.onboarding_events
    WHERE created_at >= _since
      AND phase = 'pro_location'
      AND event = 'submit'
  ),
  completed_sessions AS (
    SELECT DISTINCT session_id
    FROM public.onboarding_events
    WHERE created_at >= _since
      AND event = 'complete'
  )
  SELECT jsonb_agg(row_to_json(t))
  INTO _by_source
  FROM (
    SELECT
      s.source,
      COUNT(*) AS submits,
      COUNT(*) FILTER (WHERE s.session_id IN (SELECT session_id FROM completed_sessions)) AS completions,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE s.session_id IN (SELECT session_id FROM completed_sessions))
        / NULLIF(COUNT(*), 0)
      , 1) AS completion_rate
    FROM submits s
    GROUP BY s.source
    ORDER BY COUNT(*) DESC
  ) t;

  -- Funnel por phase: entradas (enter) vs. próximos (next/submit) vs. erros.
  SELECT jsonb_agg(row_to_json(t))
  INTO _phase_funnel
  FROM (
    SELECT
      phase,
      COUNT(*) FILTER (WHERE event = 'enter') AS enters,
      COUNT(*) FILTER (WHERE event IN ('next','submit')) AS advances,
      COUNT(*) FILTER (WHERE event = 'error') AS errors,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE event IN ('next','submit'))
        / NULLIF(COUNT(*) FILTER (WHERE event = 'enter'), 0)
      , 1) AS advance_rate
    FROM public.onboarding_events
    WHERE created_at >= _since
    GROUP BY phase
    ORDER BY enters DESC NULLS LAST
    LIMIT 30
  ) t;

  -- "Stuck" rate aproximado: sessões que entraram em pro_location mas não
  -- registraram submit + flag preview_confirmed=false vs. total entradas.
  WITH per_session AS (
    SELECT
      session_id,
      bool_or(event = 'submit') AS submitted,
      bool_or(event = 'submit' AND COALESCE((meta->>'preview_confirmed')::boolean, false)) AS preview_confirmed,
      bool_or(event = 'enter') AS entered
    FROM public.onboarding_events
    WHERE created_at >= _since
      AND phase = 'pro_location'
    GROUP BY session_id
  )
  SELECT jsonb_build_object(
    'entered', COUNT(*) FILTER (WHERE entered),
    'submitted', COUNT(*) FILTER (WHERE submitted),
    'stuck_no_submit', COUNT(*) FILTER (WHERE entered AND NOT submitted),
    'submitted_without_preview', COUNT(*) FILTER (WHERE submitted AND NOT preview_confirmed)
  )
  INTO _stuck
  FROM per_session;

  RETURN jsonb_build_object(
    'since', _since,
    'days', _days,
    'by_source', COALESCE(_by_source, '[]'::jsonb),
    'phase_funnel', COALESCE(_phase_funnel, '[]'::jsonb),
    'pro_location_stuck', COALESCE(_stuck, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_onboarding_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_stats(integer) TO authenticated;