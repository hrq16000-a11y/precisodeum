-- RPC: ranking global de engajamento (período: 30 dias por padrão)
CREATE OR REPLACE FUNCTION public.get_engagement_ranking(
  _period_days int DEFAULT 30,
  _limit int DEFAULT 100
)
RETURNS TABLE (
  rank_position bigint,
  user_id uuid,
  full_name text,
  avatar_url text,
  slug text,
  business_name text,
  city text,
  state text,
  total_points bigint,
  is_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      el.user_id,
      COALESCE(SUM(el.points_awarded), 0)::bigint AS total_points
    FROM public.engagement_log el
    WHERE el.created_at >= now() - make_interval(days => GREATEST(_period_days, 1))
    GROUP BY el.user_id
    HAVING COALESCE(SUM(el.points_awarded), 0) > 0
  ),
  ranked AS (
    SELECT
      DENSE_RANK() OVER (ORDER BY a.total_points DESC) AS rank_position,
      a.user_id,
      a.total_points
    FROM agg a
  )
  SELECT
    r.rank_position,
    r.user_id,
    pr.full_name,
    pr.avatar_url,
    pv.slug,
    pv.business_name,
    pv.city,
    pv.state,
    r.total_points,
    (r.user_id = auth.uid()) AS is_me
  FROM ranked r
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  LEFT JOIN public.providers pv ON pv.user_id = r.user_id AND pv.deleted_at IS NULL
  ORDER BY r.rank_position ASC, r.user_id
  LIMIT GREATEST(_limit, 10);
$$;

GRANT EXECUTE ON FUNCTION public.get_engagement_ranking(int, int) TO authenticated;

-- RPC: minha posição no ranking
CREATE OR REPLACE FUNCTION public.get_my_engagement_rank(
  _period_days int DEFAULT 30
)
RETURNS TABLE (
  rank_position bigint,
  total_points bigint,
  total_participants bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      el.user_id,
      COALESCE(SUM(el.points_awarded), 0)::bigint AS total_points
    FROM public.engagement_log el
    WHERE el.created_at >= now() - make_interval(days => GREATEST(_period_days, 1))
    GROUP BY el.user_id
    HAVING COALESCE(SUM(el.points_awarded), 0) > 0
  ),
  ranked AS (
    SELECT
      DENSE_RANK() OVER (ORDER BY total_points DESC) AS rank_position,
      user_id,
      total_points
    FROM agg
  )
  SELECT
    r.rank_position,
    r.total_points,
    (SELECT COUNT(*) FROM agg)::bigint AS total_participants
  FROM ranked r
  WHERE r.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_engagement_rank(int) TO authenticated;

-- RPC admin: estatísticas de instalação PWA por cidade (Curitiba/SJP em destaque)
CREATE OR REPLACE FUNCTION public.admin_pwa_install_stats_by_city()
RETURNS TABLE (
  city text,
  total_providers bigint,
  installed_providers bigint,
  install_rate numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  WITH installs AS (
    SELECT DISTINCT al.user_id
    FROM public.audit_log al
    WHERE al.action = 'pwa_install_event'
      AND (al.details->>'event' IN ('standalone_opened','accepted','installed'))
  ),
  per_city AS (
    SELECT
      LOWER(TRIM(p.city)) AS city_norm,
      MAX(p.city) AS city_label,
      COUNT(*)::bigint AS total_providers,
      COUNT(*) FILTER (WHERE p.user_id IN (SELECT user_id FROM installs))::bigint AS installed_providers
    FROM public.providers p
    WHERE p.deleted_at IS NULL
      AND p.city IS NOT NULL
      AND TRIM(p.city) <> ''
    GROUP BY LOWER(TRIM(p.city))
  )
  SELECT
    city_label AS city,
    total_providers,
    installed_providers,
    CASE WHEN total_providers > 0
      THEN ROUND((installed_providers::numeric / total_providers::numeric) * 100, 1)
      ELSE 0
    END AS install_rate
  FROM per_city
  WHERE total_providers >= 1
  ORDER BY
    CASE WHEN LOWER(city_label) IN ('curitiba','são josé dos pinhais','sao jose dos pinhais') THEN 0 ELSE 1 END,
    total_providers DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_pwa_install_stats_by_city() TO authenticated;