DROP FUNCTION IF EXISTS public.admin_list_rls_policies();

CREATE OR REPLACE FUNCTION public.admin_list_rls_policies()
RETURNS TABLE (
  schemaname text,
  tablename text,
  policyname text,
  permissive text,
  roles text[],
  cmd text,
  qual text,
  with_check text,
  table_owner text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    p.schemaname::text,
    p.tablename::text,
    p.policyname::text,
    p.permissive::text,
    p.roles::text[],
    p.cmd::text,
    p.qual::text,
    p.with_check::text,
    t.tableowner::text
  FROM pg_policies p
  LEFT JOIN pg_tables t
    ON t.schemaname = p.schemaname AND t.tablename = p.tablename
  WHERE p.schemaname = 'public'
  ORDER BY p.tablename, p.policyname;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_rls_policies() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_rls_policies() TO authenticated;