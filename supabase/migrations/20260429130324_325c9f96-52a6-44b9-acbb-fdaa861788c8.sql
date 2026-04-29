-- 1) Função validate_db_health: usada pelo dashboard como verificação prévia
CREATE OR REPLACE FUNCTION public.validate_db_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rpcs jsonb := '[]'::jsonb;
  v_columns jsonb := '[]'::jsonb;
  v_ok boolean := true;
  rec record;
  v_required_rpcs text[] := ARRAY[
    'register_service_completion',
    'audit_user_ref_health',
    'nearby_providers',
    'has_role'
  ];
  -- (table, columns) pares críticos
  v_required_columns jsonb := '[
    {"table":"audit_log","columns":["user_id","action","resource_type","resource_id","details"]},
    {"table":"media","columns":["user_ref"]},
    {"table":"profiles","columns":["user_ref","onboarding_completed"]},
    {"table":"providers","columns":["user_ref","status"]}
  ]'::jsonb;
  rname text;
  tbl jsonb;
  col text;
  exists_b boolean;
BEGIN
  -- RPCs
  FOREACH rname IN ARRAY v_required_rpcs LOOP
    SELECT EXISTS(
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=rname
    ) INTO exists_b;
    v_rpcs := v_rpcs || jsonb_build_object('name', rname, 'ok', exists_b);
    IF NOT exists_b THEN v_ok := false; END IF;
  END LOOP;

  -- Colunas críticas
  FOR tbl IN SELECT * FROM jsonb_array_elements(v_required_columns) LOOP
    FOR col IN SELECT jsonb_array_elements_text(tbl->'columns') LOOP
      SELECT EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name=(tbl->>'table')
          AND column_name=col
      ) INTO exists_b;
      v_columns := v_columns || jsonb_build_object(
        'table', tbl->>'table', 'column', col, 'ok', exists_b
      );
      IF NOT exists_b THEN v_ok := false; END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', v_ok,
    'checked_at', now(),
    'rpcs', v_rpcs,
    'columns', v_columns
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_db_health() FROM public;
GRANT EXECUTE ON FUNCTION public.validate_db_health() TO authenticated;

-- 2) Auditoria detalhada do user_ref com evidências (exemplos de IDs faltantes)
CREATE OR REPLACE FUNCTION public.audit_user_ref_full_detailed()
RETURNS TABLE(
  table_name text,
  data_type text,
  total_rows bigint,
  filled bigint,
  missing bigint,
  coverage_pct numeric,
  has_index boolean,
  sample_missing_ids text[],
  is_sponsor_table boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  q text;
  res record;
  samples text[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR rec IN
    SELECT c.table_name AS tname, c.data_type AS dtype
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='public' AND c.column_name='user_ref' AND t.table_type='BASE TABLE'
    ORDER BY c.table_name
  LOOP
    q := format(
      'SELECT COUNT(*)::bigint AS total, COUNT(user_ref)::bigint AS filled FROM public.%I',
      rec.tname
    );
    EXECUTE q INTO res;

    -- Exemplos de IDs com user_ref nulo (até 3, se houver coluna id)
    samples := ARRAY[]::text[];
    IF EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=rec.tname AND column_name='id'
    ) THEN
      BEGIN
        EXECUTE format(
          'SELECT COALESCE(array_agg(id::text),''{}''::text[]) FROM (SELECT id FROM public.%I WHERE user_ref IS NULL LIMIT 3) s',
          rec.tname
        ) INTO samples;
      EXCEPTION WHEN others THEN
        samples := ARRAY[]::text[];
      END;
    END IF;

    table_name := rec.tname;
    data_type := rec.dtype;
    total_rows := res.total;
    filled := res.filled;
    missing := res.total - res.filled;
    coverage_pct := CASE WHEN res.total>0 THEN ROUND((res.filled::numeric/res.total)*100, 2) ELSE NULL END;
    has_index := EXISTS (
      SELECT 1 FROM pg_class t2
      JOIN pg_index ix ON t2.oid=ix.indrelid
      JOIN pg_attribute a ON a.attrelid=t2.oid AND a.attnum=ANY(ix.indkey)
      JOIN pg_namespace n ON n.oid=t2.relnamespace
      WHERE n.nspname='public' AND t2.relname=rec.tname AND a.attname='user_ref'
    );
    sample_missing_ids := samples;
    is_sponsor_table := rec.tname IN ('sponsor_leads','sponsor_assets','sponsors');
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_user_ref_full_detailed() FROM public;
GRANT EXECUTE ON FUNCTION public.audit_user_ref_full_detailed() TO authenticated;

-- 3) Configurações de portabilidade
INSERT INTO public.site_settings (key, value)
VALUES
  ('restore_min_user_ref_coverage_pct', '95'::jsonb),
  ('restore_strict_mode', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;