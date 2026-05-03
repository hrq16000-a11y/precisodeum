CREATE OR REPLACE FUNCTION public.admin_capture_db_perf_snapshot_system(_reason text DEFAULT 'system', _reset_after boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
  v_n jsonb;
  v_top jsonb;
  v_idx jsonb;
  v_sizes jsonb;
BEGIN
  SELECT jsonb_build_object(
      'calls', COALESCE(SUM(calls),0),
      'mean_ms', ROUND(COALESCE(AVG(mean_exec_time)::numeric,0),2),
      'p95_ms', ROUND(COALESCE(MAX(mean_exec_time + 1.645*stddev_exec_time)::numeric,0),2),
      'max_ms', ROUND(COALESCE(MAX(max_exec_time)::numeric,0),2)
    ) INTO v_n
  FROM extensions.pg_stat_statements
  WHERE query ILIKE '%nearby_providers(%' AND query NOT ILIKE 'CREATE %' AND query NOT ILIKE 'DROP %';

  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'total_ms' DESC), '[]'::jsonb) INTO v_top
  FROM (
    SELECT jsonb_build_object(
      'calls', calls, 'mean_ms', ROUND(mean_exec_time::numeric,2),
      'p95_ms', ROUND((mean_exec_time + 1.645*stddev_exec_time)::numeric,2),
      'max_ms', ROUND(max_exec_time::numeric,2),
      'total_ms', ROUND(total_exec_time::numeric,2),
      'rows', rows, 'query', LEFT(query,200)
    ) AS t
    FROM extensions.pg_stat_statements
    WHERE query NOT ILIKE 'CREATE %' AND query NOT ILIKE 'DROP %' AND query NOT ILIKE 'ALTER %'
    ORDER BY total_exec_time DESC LIMIT 15
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'index', indexrelname, 'table', relname,
      'idx_scan', idx_scan, 'idx_tup_read', idx_tup_read, 'idx_tup_fetch', idx_tup_fetch
    ) ORDER BY idx_scan DESC), '[]'::jsonb) INTO v_idx
  FROM pg_stat_user_indexes
  WHERE schemaname='public' AND (indexrelname ILIKE '%geog%' OR relname IN ('providers','services'))
  LIMIT 30;

  SELECT jsonb_build_object(
    'providers_bytes', pg_total_relation_size('public.providers'),
    'services_bytes', pg_total_relation_size('public.services'),
    'providers_rows', (SELECT count(*) FROM public.providers),
    'providers_active', (SELECT count(*) FROM public.providers WHERE status='approved' AND deleted_at IS NULL)
  ) INTO v_sizes;

  INSERT INTO public.db_perf_snapshots (
    reason, nearby_calls, nearby_mean_ms, nearby_p95_ms, nearby_max_ms,
    top_queries, index_usage, table_sizes, reset_after
  ) VALUES (
    _reason,
    NULLIF((v_n->>'calls'),'')::bigint,
    NULLIF((v_n->>'mean_ms'),'')::numeric,
    NULLIF((v_n->>'p95_ms'),'')::numeric,
    NULLIF((v_n->>'max_ms'),'')::numeric,
    v_top, v_idx, v_sizes, _reset_after
  ) RETURNING id INTO v_id;

  IF _reset_after THEN
    PERFORM extensions.pg_stat_statements_reset();
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_capture_db_perf_snapshot_system(text, boolean) FROM public, anon, authenticated;
