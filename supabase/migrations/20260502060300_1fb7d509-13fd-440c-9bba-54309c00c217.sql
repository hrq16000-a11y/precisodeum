-- Admin-only RPC: consolida providers.meta_tracking (JSONB) em estatísticas
CREATE OR REPLACE FUNCTION public.admin_meta_tracking_quality()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_total bigint;
  v_with_meta bigint;
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total FROM public.providers;
  SELECT count(*) INTO v_with_meta
    FROM public.providers
   WHERE meta_tracking IS NOT NULL AND jsonb_typeof(meta_tracking) = 'object';

  WITH base AS (
    SELECT id, category_id, meta_tracking AS m, registered_at
      FROM public.providers
     WHERE meta_tracking IS NOT NULL AND jsonb_typeof(meta_tracking) = 'object'
  ),
  cov AS (
    SELECT
      count(*) FILTER (WHERE m ? 'attribution')                                  AS has_attribution,
      count(*) FILTER (WHERE m ? 'network')                                      AS has_network,
      count(*) FILTER (WHERE m ? 'movement')                                     AS has_movement,
      count(*) FILTER (WHERE m ? 'terms')                                        AS has_terms,
      count(*) FILTER (WHERE (m->'network'->>'type') IS NOT NULL)                AS has_network_type,
      count(*) FILTER (WHERE (m->'attribution'->>'referrer_kind') IS NOT NULL)   AS has_referrer_kind
      FROM base
  ),
  conn AS (
    SELECT lower(coalesce(NULLIF(m->'network'->>'type',''),'unknown')) AS k, count(*) AS n
      FROM base GROUP BY 1
  ),
  dev AS (
    SELECT
      CASE
        WHEN (m->'device'->>'type') IS NOT NULL THEN lower(m->'device'->>'type')
        WHEN (m->>'device_type') IS NOT NULL THEN lower(m->>'device_type')
        ELSE 'unknown'
      END AS k,
      count(*) AS n
      FROM base GROUP BY 1
  ),
  mov AS (
    SELECT
      count(*) FILTER (WHERE (m->'movement'->>'was_moving')::boolean = true) AS moving,
      count(*) FILTER (WHERE m ? 'movement')                                  AS movement_total
      FROM base
  ),
  ref AS (
    SELECT lower(coalesce(NULLIF(m->'attribution'->>'referrer_kind',''),'unknown')) AS k, count(*) AS n
      FROM base GROUP BY 1
  ),
  gps AS (
    SELECT sc.name AS category,
           round(avg(NULLIF((m->'gps'->>'accuracy_m')::numeric, 0))::numeric, 1) AS avg_accuracy_m,
           count(*) AS samples
      FROM base b
      LEFT JOIN public.service_categories sc ON sc.id = b.category_id
     WHERE (m->'gps'->>'accuracy_m') IS NOT NULL
     GROUP BY sc.name
     ORDER BY samples DESC
     LIMIT 30
  ),
  recent AS (
    SELECT count(*) AS last7
      FROM base
     WHERE registered_at >= now() - interval '7 days'
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'providers_total', v_total,
      'providers_with_meta', v_with_meta,
      'coverage_pct', CASE WHEN v_total > 0 THEN round(100.0 * v_with_meta / v_total, 1) ELSE 0 END,
      'last7_with_meta', (SELECT last7 FROM recent)
    ),
    'field_coverage', (SELECT to_jsonb(cov) FROM cov),
    'connection_type', (SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC) FROM conn),
    'device_type', (SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC) FROM dev),
    'movement', jsonb_build_object(
      'in_field', (SELECT moving FROM mov),
      'sampled', (SELECT movement_total FROM mov),
      'in_field_pct', CASE WHEN (SELECT movement_total FROM mov) > 0
                            THEN round(100.0 * (SELECT moving FROM mov) / (SELECT movement_total FROM mov), 1)
                            ELSE 0 END
    ),
    'referrer_kind', (SELECT jsonb_agg(jsonb_build_object('key', k, 'count', n) ORDER BY n DESC) FROM ref),
    'gps_accuracy_by_category', (SELECT jsonb_agg(jsonb_build_object(
      'category', coalesce(category,'(sem categoria)'),
      'avg_accuracy_m', avg_accuracy_m,
      'samples', samples
    )) FROM gps)
  ) INTO v_result;

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_meta_tracking_quality() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_meta_tracking_quality() TO authenticated;