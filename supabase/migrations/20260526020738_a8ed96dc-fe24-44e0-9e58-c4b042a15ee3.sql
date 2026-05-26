
-- =====================================================================
-- ONBOARDING OPS · ADMIN READ RPCs (no new tables)
-- Todas SECURITY DEFINER + has_role(auth.uid(),'admin') guard.
-- Read-only sobre public.onboarding_events.
-- =====================================================================

-- 1) FUNNEL SUMMARY -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_onboarding_ops_funnel(
  _hours integer DEFAULT 24
)
RETURNS TABLE (
  phase text,
  enters bigint,
  exits bigint,
  completes bigint,
  abandons bigint,
  refreshes bigint,
  recoveries bigint,
  validation_failed bigint,
  autosave_failed bigint,
  regressions bigint,
  unique_sessions bigint,
  unique_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF _hours IS NULL OR _hours < 1 THEN _hours := 24; END IF;
  IF _hours > 24 * 30 THEN _hours := 24 * 30; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      COALESCE(NULLIF(oe.phase, ''), '(none)') AS phase,
      oe.event,
      oe.session_id,
      oe.user_id
    FROM public.onboarding_events oe
    WHERE oe.created_at >= now() - make_interval(hours => _hours)
  )
  SELECT
    b.phase,
    count(*) FILTER (WHERE b.event IN ('phase_enter','enter'))                                       AS enters,
    count(*) FILTER (WHERE b.event IN ('phase_exit','exit','next','advance'))                       AS exits,
    count(*) FILTER (WHERE b.event IN ('complete','phase_complete','done'))                         AS completes,
    count(*) FILTER (WHERE b.event IN ('abandon','phase_abandon','dropoff'))                        AS abandons,
    count(*) FILTER (WHERE b.event IN ('refresh','page_refresh','reload'))                          AS refreshes,
    count(*) FILTER (WHERE b.event ILIKE 'recovery%')                                               AS recoveries,
    count(*) FILTER (WHERE b.event ILIKE 'validation_failed%' OR b.event = 'validation_error')      AS validation_failed,
    count(*) FILTER (WHERE b.event ILIKE 'autosave%fail%' OR b.event = 'autosave_remote_failed')    AS autosave_failed,
    count(*) FILTER (WHERE b.event = 'onboarding_regression_detected')                              AS regressions,
    count(DISTINCT b.session_id)                                                                    AS unique_sessions,
    count(DISTINCT b.user_id)                                                                       AS unique_users
  FROM base b
  GROUP BY b.phase
  ORDER BY enters DESC, b.phase ASC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_onboarding_ops_funnel(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_ops_funnel(integer) TO authenticated;

-- 2) SESSION FORENSICS TIMELINE ----------------------------------------
CREATE OR REPLACE FUNCTION public.admin_onboarding_session_timeline(
  _session_id text,
  _limit integer DEFAULT 500
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  phase text,
  event text,
  variant text,
  user_id uuid,
  meta jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF _session_id IS NULL OR length(_session_id) < 3 THEN
    RAISE EXCEPTION 'invalid_session_id';
  END IF;
  IF _limit IS NULL OR _limit < 1 THEN _limit := 500; END IF;
  IF _limit > 2000 THEN _limit := 2000; END IF;

  RETURN QUERY
  SELECT
    oe.id,
    oe.created_at,
    oe.phase,
    oe.event,
    oe.variant,
    oe.user_id,
    -- Strip PII-ish keys defensively
    (oe.meta - 'email' - 'whatsapp' - 'phone' - 'cpf' - 'cnpj' - 'tax_id') AS meta
  FROM public.onboarding_events oe
  WHERE oe.session_id = _session_id
  ORDER BY oe.created_at ASC
  LIMIT _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_onboarding_session_timeline(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_session_timeline(text, integer) TO authenticated;

-- 3) RELEASE IMPACT COMPARE --------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_onboarding_release_compare(
  _hours integer DEFAULT 72
)
RETURNS TABLE (
  app_version text,
  release_channel text,
  total_events bigint,
  unique_sessions bigint,
  unique_users bigint,
  completes bigint,
  abandons bigint,
  validation_failed bigint,
  autosave_failed bigint,
  regressions bigint,
  first_seen timestamptz,
  last_seen timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF _hours IS NULL OR _hours < 1 THEN _hours := 72; END IF;
  IF _hours > 24 * 60 THEN _hours := 24 * 60; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      COALESCE(NULLIF(oe.meta->>'app_version',''), '(unknown)')        AS app_version,
      COALESCE(NULLIF(oe.meta->>'release_channel',''), '(unknown)')    AS release_channel,
      oe.event,
      oe.session_id,
      oe.user_id,
      oe.created_at
    FROM public.onboarding_events oe
    WHERE oe.created_at >= now() - make_interval(hours => _hours)
  )
  SELECT
    b.app_version,
    b.release_channel,
    count(*)                                                                                    AS total_events,
    count(DISTINCT b.session_id)                                                                AS unique_sessions,
    count(DISTINCT b.user_id)                                                                   AS unique_users,
    count(*) FILTER (WHERE b.event IN ('complete','phase_complete','done'))                     AS completes,
    count(*) FILTER (WHERE b.event IN ('abandon','phase_abandon','dropoff'))                    AS abandons,
    count(*) FILTER (WHERE b.event ILIKE 'validation_failed%')                                  AS validation_failed,
    count(*) FILTER (WHERE b.event ILIKE 'autosave%fail%')                                      AS autosave_failed,
    count(*) FILTER (WHERE b.event = 'onboarding_regression_detected')                          AS regressions,
    min(b.created_at)                                                                           AS first_seen,
    max(b.created_at)                                                                           AS last_seen
  FROM base b
  GROUP BY b.app_version, b.release_channel
  ORDER BY total_events DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_onboarding_release_compare(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_release_compare(integer) TO authenticated;

-- Index opcional para acelerar a busca por sessão (idempotente)
CREATE INDEX IF NOT EXISTS idx_onboarding_events_session_created
  ON public.onboarding_events (session_id, created_at);
