-- Funnel segmentado por draft_source (local/remote/seed/none)
CREATE OR REPLACE FUNCTION public.admin_onboarding_funnel_by_source(
  _days integer DEFAULT 30
)
RETURNS TABLE(
  draft_source text,
  phase text,
  enters bigint,
  advances bigint,
  errors bigint,
  unique_users bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      e.user_id,
      e.session_id,
      e.phase,
      e.event,
      COALESCE(NULLIF(e.meta->>'draft_source', ''), 'none') AS draft_source
    FROM public.onboarding_events e
    WHERE e.created_at >= now() - (GREATEST(_days, 1) || ' days')::interval
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  SELECT
    draft_source,
    phase,
    COUNT(*) FILTER (WHERE event = 'enter')::bigint AS enters,
    COUNT(*) FILTER (WHERE event IN ('next', 'submit'))::bigint AS advances,
    COUNT(*) FILTER (WHERE event = 'error')::bigint AS errors,
    COUNT(DISTINCT user_id)::bigint AS unique_users
  FROM base
  GROUP BY draft_source, phase
  ORDER BY draft_source, phase;
$$;

-- Funnel por usuário: quantas fases cada usuário concluiu na janela
CREATE OR REPLACE FUNCTION public.admin_onboarding_user_funnel(
  _days integer DEFAULT 30,
  _limit integer DEFAULT 200
)
RETURNS TABLE(
  user_id uuid,
  phases_entered bigint,
  phases_advanced bigint,
  errors_total bigint,
  last_phase text,
  completed boolean,
  draft_source text,
  first_seen timestamptz,
  last_seen timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      e.user_id,
      e.phase,
      e.event,
      e.created_at,
      COALESCE(NULLIF(e.meta->>'draft_source', ''), 'none') AS draft_source
    FROM public.onboarding_events e
    WHERE e.created_at >= now() - (GREATEST(_days, 1) || ' days')::interval
      AND e.user_id IS NOT NULL
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
  ),
  agg AS (
    SELECT
      user_id,
      COUNT(DISTINCT phase) FILTER (WHERE event = 'enter')::bigint AS phases_entered,
      COUNT(DISTINCT phase) FILTER (WHERE event IN ('next', 'submit'))::bigint AS phases_advanced,
      COUNT(*) FILTER (WHERE event = 'error')::bigint AS errors_total,
      bool_or(event = 'complete') AS completed,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen
    FROM base
    GROUP BY user_id
  ),
  last_phase_per_user AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      phase AS last_phase
    FROM base
    ORDER BY user_id, created_at DESC
  ),
  source_per_user AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      draft_source
    FROM base
    WHERE draft_source <> 'none'
    ORDER BY user_id, created_at ASC
  )
  SELECT
    a.user_id,
    a.phases_entered,
    a.phases_advanced,
    a.errors_total,
    lp.last_phase,
    a.completed,
    COALESCE(s.draft_source, 'none') AS draft_source,
    a.first_seen,
    a.last_seen
  FROM agg a
  LEFT JOIN last_phase_per_user lp USING (user_id)
  LEFT JOIN source_per_user s USING (user_id)
  ORDER BY a.last_seen DESC
  LIMIT GREATEST(_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.admin_onboarding_funnel_by_source(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_user_funnel(integer, integer) TO authenticated;