-- 1) Tabela de snapshots históricos
CREATE TABLE IF NOT EXISTS public.db_perf_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'manual',
  nearby_calls bigint,
  nearby_mean_ms numeric,
  nearby_p95_ms numeric,
  nearby_max_ms numeric,
  top_queries jsonb NOT NULL DEFAULT '[]'::jsonb,
  index_usage jsonb NOT NULL DEFAULT '[]'::jsonb,
  table_sizes jsonb NOT NULL DEFAULT '{}'::jsonb,
  reset_after boolean NOT NULL DEFAULT false,
  created_by uuid
);

ALTER TABLE public.db_perf_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view db_perf_snapshots"
  ON public.db_perf_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert db_perf_snapshots"
  ON public.db_perf_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_db_perf_snapshots_captured_at
  ON public.db_perf_snapshots (captured_at DESC);

-- 2) Tabela de execuções k6
CREATE TABLE IF NOT EXISTS public.k6_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  scenario text NOT NULL,
  vus_max integer,
  iterations integer,
  http_reqs integer,
  duration_seconds integer,
  p95_ms numeric,
  p99_ms numeric,
  avg_ms numeric,
  error_rate numeric,
  passed_slo boolean,
  notes text,
  raw_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid
);

ALTER TABLE public.k6_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view k6_runs"
  ON public.k6_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert k6_runs"
  ON public.k6_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete k6_runs"
  ON public.k6_runs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_k6_runs_created_scenario
  ON public.k6_runs (scenario, created_at DESC);

-- 3) RPC dashboard ao vivo
CREATE OR REPLACE FUNCTION public.admin_db_perf_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_nearby jsonb;
  v_top jsonb;
  v_idx jsonb;
  v_sizes jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
      'calls', COALESCE(SUM(calls),0),
      'mean_ms', ROUND(COALESCE(AVG(mean_exec_time)::numeric,0),2),
      'p95_ms', ROUND(COALESCE(MAX(mean_exec_time + 1.645*stddev_exec_time)::numeric,0),2),
      'max_ms', ROUND(COALESCE(MAX(max_exec_time)::numeric,0),2),
      'total_ms', ROUND(COALESCE(SUM(total_exec_time)::numeric,0),2)
    ) INTO v_nearby
  FROM extensions.pg_stat_statements
  WHERE query ILIKE '%nearby_providers(%' AND query NOT ILIKE 'CREATE %' AND query NOT ILIKE 'DROP %';

  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'total_ms' DESC), '[]'::jsonb) INTO v_top
  FROM (
    SELECT jsonb_build_object(
      'calls', calls,
      'mean_ms', ROUND(mean_exec_time::numeric,2),
      'p95_ms', ROUND((mean_exec_time + 1.645*stddev_exec_time)::numeric,2),
      'max_ms', ROUND(max_exec_time::numeric,2),
      'total_ms', ROUND(total_exec_time::numeric,2),
      'rows', rows,
      'query', LEFT(query,200)
    ) AS t
    FROM extensions.pg_stat_statements
    WHERE query NOT ILIKE 'CREATE %' AND query NOT ILIKE 'DROP %' AND query NOT ILIKE 'ALTER %'
    ORDER BY total_exec_time DESC
    LIMIT 15
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'index', indexrelname,
      'table', relname,
      'idx_scan', idx_scan,
      'idx_tup_read', idx_tup_read,
      'idx_tup_fetch', idx_tup_fetch,
      'is_gist', indexrelname IN ('idx_providers_geog','idx_providers_geog_active')
    ) ORDER BY idx_scan DESC), '[]'::jsonb) INTO v_idx
  FROM pg_stat_user_indexes
  WHERE schemaname='public'
    AND (indexrelname ILIKE '%geog%' OR relname IN ('providers','services'))
  LIMIT 30;

  SELECT jsonb_build_object(
    'providers_bytes', pg_total_relation_size('public.providers'),
    'services_bytes', pg_total_relation_size('public.services'),
    'providers_rows', (SELECT count(*) FROM public.providers),
    'providers_active', (SELECT count(*) FROM public.providers WHERE status='approved' AND deleted_at IS NULL)
  ) INTO v_sizes;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'nearby_providers', v_nearby,
    'top_queries', v_top,
    'index_usage', v_idx,
    'sizes', v_sizes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_db_perf_dashboard() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_db_perf_dashboard() TO authenticated;

-- 4) RPC capture snapshot
CREATE OR REPLACE FUNCTION public.admin_capture_db_perf_snapshot(_reason text DEFAULT 'manual', _reset_after boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_dash jsonb;
  v_id uuid;
  v_n jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_dash := public.admin_db_perf_dashboard();
  v_n := v_dash->'nearby_providers';

  INSERT INTO public.db_perf_snapshots (
    reason, nearby_calls, nearby_mean_ms, nearby_p95_ms, nearby_max_ms,
    top_queries, index_usage, table_sizes, reset_after, created_by
  ) VALUES (
    _reason,
    NULLIF((v_n->>'calls'),'')::bigint,
    NULLIF((v_n->>'mean_ms'),'')::numeric,
    NULLIF((v_n->>'p95_ms'),'')::numeric,
    NULLIF((v_n->>'max_ms'),'')::numeric,
    COALESCE(v_dash->'top_queries','[]'::jsonb),
    COALESCE(v_dash->'index_usage','[]'::jsonb),
    COALESCE(v_dash->'sizes','{}'::jsonb),
    _reset_after,
    auth.uid()
  ) RETURNING id INTO v_id;

  IF _reset_after THEN
    PERFORM extensions.pg_stat_statements_reset();
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_capture_db_perf_snapshot(text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_capture_db_perf_snapshot(text, boolean) TO authenticated;

-- 5) Drop GIST redundante (mantém idx_providers_geog_active parcial)
DROP INDEX IF EXISTS public.idx_providers_geog;
