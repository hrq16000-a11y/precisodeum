-- 1) Marca como archived os providers em pending há >24h sem cidade
CREATE OR REPLACE FUNCTION public.archive_stale_incomplete_providers()
RETURNS TABLE(archived_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.providers
    SET status = 'archived', updated_at = now()
    WHERE status = 'pending'
      AND created_at < now() - interval '24 hours'
      AND (city IS NULL OR TRIM(city) = '')
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO v_count FROM updated;
  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_stale_incomplete_providers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_stale_incomplete_providers() TO service_role;

-- 2) Auditoria — admin-only
CREATE OR REPLACE FUNCTION public.audit_incomplete_providers_3d()
RETURNS TABLE(
  total_3d integer,
  cidade_sem_bairro integer,
  cidade_sem_geosource integer,
  ambos_faltando integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    COUNT(*)::int AS total_3d,
    COUNT(*) FILTER (WHERE city <> '' AND (neighborhood IS NULL OR neighborhood = ''))::int AS cidade_sem_bairro,
    COUNT(*) FILTER (WHERE city <> '' AND (geo_source IS NULL OR geo_source = 'unknown'))::int AS cidade_sem_geosource,
    COUNT(*) FILTER (WHERE city <> ''
       AND (neighborhood IS NULL OR neighborhood = '')
       AND (geo_source IS NULL OR geo_source = 'unknown'))::int AS ambos_faltando
  FROM public.providers
  WHERE created_at > now() - interval '3 days';
END;
$$;

REVOKE ALL ON FUNCTION public.audit_incomplete_providers_3d() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_incomplete_providers_3d() TO authenticated, service_role;