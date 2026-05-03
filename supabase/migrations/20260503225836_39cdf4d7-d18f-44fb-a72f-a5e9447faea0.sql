CREATE OR REPLACE FUNCTION public.admin_auth_health_summary(
  _since timestamptz,
  _bucket text DEFAULT 'hour'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_bucket text := lower(coalesce(_bucket, 'hour'));
  v_counts jsonb;
  v_series jsonb;
  v_total bigint;
  v_detected bigint;
  v_healed bigint;
  v_failed bigint;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_bucket NOT IN ('hour', 'day') THEN
    v_bucket := 'hour';
  END IF;

  WITH base AS (
    SELECT
      coalesce(meta->>'error_code', meta->>'reason', 'OUTRO') AS code,
      user_id,
      created_at
    FROM public.onboarding_events
    WHERE event = 'error'
      AND created_at >= _since
  ),
  by_code AS (
    SELECT code, count(*)::bigint AS n
    FROM base
    GROUP BY code
  ),
  loop_users AS (
    SELECT count(DISTINCT user_id)::bigint AS n
    FROM base
    WHERE code = 'B_PROFILE_NULL_LOOP_GUARD' AND user_id IS NOT NULL
  ),
  by_bucket AS (
    SELECT
      CASE WHEN v_bucket = 'day'
        THEN date_trunc('day', created_at)
        ELSE date_trunc('hour', created_at)
      END AS bucket,
      code,
      count(*)::bigint AS n
    FROM base
    WHERE code IN ('B_PROFILE_NULL','C_RLS_403','A_AUTH_FAIL')
    GROUP BY 1, 2
  ),
  series AS (
    SELECT
      bucket,
      sum(n) FILTER (WHERE code = 'B_PROFILE_NULL')::bigint AS b_profile_null,
      sum(n) FILTER (WHERE code = 'C_RLS_403')::bigint     AS c_rls_403,
      sum(n) FILTER (WHERE code = 'A_AUTH_FAIL')::bigint   AS a_auth_fail
    FROM by_bucket
    GROUP BY bucket
    ORDER BY bucket
  )
  SELECT
    coalesce(jsonb_object_agg(by_code.code, by_code.n), '{}'::jsonb)
  INTO v_counts
  FROM by_code;

  SELECT count(*) INTO v_total FROM public.onboarding_events
    WHERE event = 'error' AND created_at >= _since;

  v_detected := coalesce((v_counts->>'B_PROFILE_NULL')::bigint, 0);
  v_healed   := coalesce((v_counts->>'B_PROFILE_NULL_HEALED')::bigint, 0);
  v_failed   := coalesce((v_counts->>'B_PROFILE_NULL_HEAL_FAIL')::bigint, 0);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'bucket', s.bucket,
    'B_PROFILE_NULL', coalesce(s.b_profile_null, 0),
    'C_RLS_403',     coalesce(s.c_rls_403, 0),
    'A_AUTH_FAIL',   coalesce(s.a_auth_fail, 0)
  ) ORDER BY s.bucket), '[]'::jsonb)
  INTO v_series
  FROM series s;

  RETURN jsonb_build_object(
    'since', _since,
    'bucket', v_bucket,
    'total_errors', v_total,
    'counts', v_counts,
    'funnel', jsonb_build_object(
      'detected', v_detected,
      'attempted', v_healed + v_failed,
      'healed', v_healed,
      'failed', v_failed,
      'loop_guard_unique_users',
        coalesce((SELECT n FROM loop_users), 0)
    ),
    'series', v_series
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_auth_health_summary(timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_auth_health_summary(timestamptz, text) TO authenticated;
