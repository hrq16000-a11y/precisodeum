CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.rls_policy_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  schemaname TEXT NOT NULL,
  tablename TEXT NOT NULL,
  policyname TEXT NOT NULL,
  cmd TEXT,
  roles TEXT[],
  qual TEXT,
  with_check TEXT,
  is_permissive_write BOOLEAN NOT NULL DEFAULT false,
  is_public_or_anon BOOLEAN NOT NULL DEFAULT false,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, schemaname, tablename, policyname)
);

CREATE INDEX IF NOT EXISTS idx_rls_snapshots_date ON public.rls_policy_snapshots (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_rls_snapshots_table ON public.rls_policy_snapshots (tablename, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_rls_snapshots_risk ON public.rls_policy_snapshots (snapshot_date DESC) WHERE is_permissive_write = true AND is_public_or_anon = true;

ALTER TABLE public.rls_policy_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read RLS snapshots" ON public.rls_policy_snapshots;
CREATE POLICY "Admins can read RLS snapshots"
  ON public.rls_policy_snapshots
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.admin_capture_rls_snapshot()
RETURNS TABLE (out_inserted_count INTEGER, out_snapshot_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  INSERT INTO public.rls_policy_snapshots AS s (
    snapshot_date, schemaname, tablename, policyname, cmd, roles, qual, with_check,
    is_permissive_write, is_public_or_anon
  )
  SELECT
    v_today,
    p.schemaname::text,
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    p.roles::text[],
    p.qual::text,
    p.with_check::text,
    (p.cmd::text IN ('INSERT','UPDATE','DELETE','ALL')
      AND (COALESCE(p.qual::text,'') = 'true' OR COALESCE(p.with_check::text,'') = 'true')) AS is_permissive_write,
    (EXISTS (SELECT 1 FROM unnest(p.roles::text[]) r WHERE r IN ('public','anon'))) AS is_public_or_anon
  FROM pg_policies p
  WHERE p.schemaname = 'public'
  ON CONFLICT (snapshot_date, schemaname, tablename, policyname) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  out_inserted_count := v_count;
  out_snapshot_date := v_today;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_capture_rls_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_capture_rls_snapshot() TO authenticated, postgres;

CREATE OR REPLACE FUNCTION public.admin_list_rls_snapshot_dates()
RETURNS TABLE (out_snapshot_date DATE, policy_count BIGINT, permissive_write_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
    SELECT s.snapshot_date,
           COUNT(*)::BIGINT,
           COUNT(*) FILTER (WHERE s.is_permissive_write AND s.is_public_or_anon)::BIGINT
    FROM public.rls_policy_snapshots s
    GROUP BY s.snapshot_date
    ORDER BY s.snapshot_date DESC
    LIMIT 90;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_rls_snapshot_dates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_rls_snapshot_dates() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_diff_rls_snapshots(from_date DATE, to_date DATE)
RETURNS TABLE (
  status TEXT,
  schemaname TEXT,
  tablename TEXT,
  policyname TEXT,
  cmd_old TEXT,
  cmd_new TEXT,
  roles_old TEXT[],
  roles_new TEXT[],
  qual_old TEXT,
  qual_new TEXT,
  with_check_old TEXT,
  with_check_new TEXT,
  is_permissive_write_new BOOLEAN,
  is_public_or_anon_new BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  WITH old_snap AS (
    SELECT * FROM public.rls_policy_snapshots WHERE snapshot_date = from_date
  ),
  new_snap AS (
    SELECT * FROM public.rls_policy_snapshots WHERE snapshot_date = to_date
  )
  SELECT 'added'::text, n.schemaname, n.tablename, n.policyname,
         NULL::text, n.cmd, NULL::text[], n.roles,
         NULL::text, n.qual, NULL::text, n.with_check,
         n.is_permissive_write, n.is_public_or_anon
  FROM new_snap n
  LEFT JOIN old_snap o
    ON o.schemaname = n.schemaname AND o.tablename = n.tablename AND o.policyname = n.policyname
  WHERE o.policyname IS NULL
  UNION ALL
  SELECT 'removed'::text, o.schemaname, o.tablename, o.policyname,
         o.cmd, NULL::text, o.roles, NULL::text[],
         o.qual, NULL::text, o.with_check, NULL::text,
         false, false
  FROM old_snap o
  LEFT JOIN new_snap n
    ON n.schemaname = o.schemaname AND n.tablename = o.tablename AND n.policyname = o.policyname
  WHERE n.policyname IS NULL
  UNION ALL
  SELECT 'changed'::text, n.schemaname, n.tablename, n.policyname,
         o.cmd, n.cmd, o.roles, n.roles,
         o.qual, n.qual, o.with_check, n.with_check,
         n.is_permissive_write, n.is_public_or_anon
  FROM new_snap n
  JOIN old_snap o
    ON o.schemaname = n.schemaname AND o.tablename = n.tablename AND o.policyname = n.policyname
  WHERE COALESCE(o.cmd,'') IS DISTINCT FROM COALESCE(n.cmd,'')
     OR COALESCE(o.qual,'') IS DISTINCT FROM COALESCE(n.qual,'')
     OR COALESCE(o.with_check,'') IS DISTINCT FROM COALESCE(n.with_check,'')
     OR array_to_string(COALESCE(o.roles,'{}'::text[]),',') IS DISTINCT FROM array_to_string(COALESCE(n.roles,'{}'::text[]),',')
  ORDER BY 1, 3, 4;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_diff_rls_snapshots(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_diff_rls_snapshots(DATE, DATE) TO authenticated;

SELECT public.admin_capture_rls_snapshot();