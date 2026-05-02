-- Top paths 404 nos últimos N dias
CREATE OR REPLACE FUNCTION public.admin_broken_links_stats(_days integer DEFAULT 7)
RETURNS TABLE (
  path text,
  hits bigint,
  distinct_users bigint,
  last_seen timestamptz,
  top_referrer text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT e.path, e.referrer, e.user_id, e.occurred_at
    FROM public.error_page_events e
    WHERE e.code = 404
      AND e.occurred_at > now() - make_interval(days => GREATEST(_days, 1))
  ),
  ref_rank AS (
    SELECT
      path,
      COALESCE(referrer, '(direct)') AS ref,
      COUNT(*) AS c,
      ROW_NUMBER() OVER (PARTITION BY path ORDER BY COUNT(*) DESC) AS rn
    FROM base
    GROUP BY path, COALESCE(referrer, '(direct)')
  )
  SELECT
    b.path,
    COUNT(*)::bigint AS hits,
    COUNT(DISTINCT b.user_id)::bigint AS distinct_users,
    MAX(b.occurred_at) AS last_seen,
    (SELECT r.ref FROM ref_rank r WHERE r.path = b.path AND r.rn = 1 LIMIT 1) AS top_referrer
  FROM base b
  GROUP BY b.path
  ORDER BY hits DESC
  LIMIT 200;
END;
$$;

-- Top referrers que apontam para 404
CREATE OR REPLACE FUNCTION public.admin_broken_links_by_referrer(_days integer DEFAULT 7)
RETURNS TABLE (
  referrer text,
  hits bigint,
  distinct_paths bigint,
  last_seen timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(e.referrer, '(direct)') AS referrer,
    COUNT(*)::bigint AS hits,
    COUNT(DISTINCT e.path)::bigint AS distinct_paths,
    MAX(e.occurred_at) AS last_seen
  FROM public.error_page_events e
  WHERE e.code = 404
    AND e.occurred_at > now() - make_interval(days => GREATEST(_days, 1))
  GROUP BY COALESCE(e.referrer, '(direct)')
  ORDER BY hits DESC
  LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_broken_links_stats(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_broken_links_by_referrer(integer) TO authenticated;