
-- 1) Funil de cadastro agregado por dia
CREATE OR REPLACE FUNCTION public.admin_signup_funnel(_days int DEFAULT 14)
RETURNS TABLE (
  day date,
  visitors bigint,
  wizard_started bigint,
  drafts_saved bigint,
  profiles_created bigint,
  providers_created bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      (now() - (GREATEST(_days,1) || ' days')::interval)::date,
      now()::date,
      '1 day'::interval
    )::date AS day
  ),
  v AS (
    SELECT created_at::date AS day, COUNT(DISTINCT user_id)::bigint AS c
    FROM public.user_access_logs
    WHERE created_at > now() - (GREATEST(_days,1) || ' days')::interval
    GROUP BY 1
  ),
  w AS (
    SELECT created_at::date AS day, COUNT(DISTINCT COALESCE(user_id::text, session_id))::bigint AS c
    FROM public.onboarding_events
    WHERE created_at > now() - (GREATEST(_days,1) || ' days')::interval
      AND event = 'enter'
    GROUP BY 1
  ),
  d AS (
    SELECT updated_at::date AS day, COUNT(*)::bigint AS c
    FROM public.onboarding_v2_drafts
    WHERE updated_at > now() - (GREATEST(_days,1) || ' days')::interval
    GROUP BY 1
  ),
  p AS (
    SELECT created_at::date AS day, COUNT(*)::bigint AS c
    FROM public.profiles
    WHERE created_at > now() - (GREATEST(_days,1) || ' days')::interval
    GROUP BY 1
  ),
  pr AS (
    SELECT created_at::date AS day, COUNT(*)::bigint AS c
    FROM public.providers
    WHERE created_at > now() - (GREATEST(_days,1) || ' days')::interval
    GROUP BY 1
  )
  SELECT
    days.day,
    COALESCE(v.c,  0),
    COALESCE(w.c,  0),
    COALESCE(d.c,  0),
    COALESCE(p.c,  0),
    COALESCE(pr.c, 0)
  FROM days
  LEFT JOIN v  USING (day)
  LEFT JOIN w  USING (day)
  LEFT JOIN d  USING (day)
  LEFT JOIN p  USING (day)
  LEFT JOIN pr USING (day)
  ORDER BY days.day DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_signup_funnel(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_signup_funnel(int) TO authenticated;

-- 2) Resumo de erros 500
CREATE OR REPLACE FUNCTION public.admin_error_500_summary(_hours int DEFAULT 48)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH base AS (
    SELECT * FROM public.error_page_events
    WHERE code = 500
      AND occurred_at > now() - (GREATEST(_hours,1) || ' hours')::interval
  ),
  totals AS (
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE occurred_at > now() - interval '1 hour')::bigint AS last_hour,
      COUNT(*) FILTER (WHERE occurred_at > now() - interval '24 hours')::bigint AS last_24h,
      COUNT(DISTINCT user_id)::bigint AS unique_users
    FROM base
  ),
  by_hour AS (
    SELECT jsonb_agg(jsonb_build_object('hour', h, 'count', c) ORDER BY h) AS arr
    FROM (
      SELECT EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'America/Sao_Paulo')::int AS h, COUNT(*)::bigint AS c
      FROM base GROUP BY 1
    ) x
  ),
  by_day AS (
    SELECT jsonb_agg(jsonb_build_object('day', d, 'count', c) ORDER BY d) AS arr
    FROM (
      SELECT (occurred_at AT TIME ZONE 'America/Sao_Paulo')::date AS d, COUNT(*)::bigint AS c
      FROM base GROUP BY 1
    ) x
  ),
  top_paths AS (
    SELECT jsonb_agg(jsonb_build_object('path', path, 'count', c) ORDER BY c DESC) AS arr
    FROM (
      SELECT regexp_replace(path, '\?.*$', '') AS path, COUNT(*)::bigint AS c
      FROM base GROUP BY 1 ORDER BY 2 DESC LIMIT 10
    ) x
  ),
  top_referrers AS (
    SELECT jsonb_agg(jsonb_build_object('referrer', referrer, 'count', c) ORDER BY c DESC) AS arr
    FROM (
      SELECT COALESCE(NULLIF(referrer, ''), '(direto)') AS referrer, COUNT(*)::bigint AS c
      FROM base GROUP BY 1 ORDER BY 2 DESC LIMIT 10
    ) x
  )
  SELECT jsonb_build_object(
    'total', t.total,
    'last_hour', t.last_hour,
    'last_24h', t.last_24h,
    'unique_users', t.unique_users,
    'by_hour', COALESCE(by_hour.arr, '[]'::jsonb),
    'by_day', COALESCE(by_day.arr, '[]'::jsonb),
    'top_paths', COALESCE(top_paths.arr, '[]'::jsonb),
    'top_referrers', COALESCE(top_referrers.arr, '[]'::jsonb)
  ) INTO result
  FROM totals t, by_hour, by_day, top_paths, top_referrers;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_error_500_summary(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_error_500_summary(int) TO authenticated;

-- 3) Eventos recentes de 500
CREATE OR REPLACE FUNCTION public.admin_error_500_recent(_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  occurred_at timestamptz,
  path text,
  referrer text,
  user_id uuid,
  user_agent text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, occurred_at, path, referrer, user_id, user_agent
  FROM public.error_page_events
  WHERE code = 500
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  ORDER BY occurred_at DESC
  LIMIT GREATEST(LEAST(_limit, 500), 1);
$$;

REVOKE ALL ON FUNCTION public.admin_error_500_recent(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_error_500_recent(int) TO authenticated;
