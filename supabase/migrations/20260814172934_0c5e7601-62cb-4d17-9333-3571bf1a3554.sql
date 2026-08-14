-- 1) AGENCIES: revoke table-wide SELECT from authenticated, grant only safe columns
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum) INTO cols
  FROM pg_attribute
  WHERE attrelid = 'public.agencies'::regclass AND attnum > 0 AND NOT attisdropped
    AND attname NOT IN ('cnpj', 'email', 'legal_name');
  EXECUTE 'REVOKE SELECT ON public.agencies FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.agencies TO authenticated', cols);
END $$;

CREATE OR REPLACE FUNCTION public.get_agency_private(_agency_id uuid)
RETURNS TABLE(id uuid, cnpj text, email text, legal_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.cnpj, a.email, a.legal_name
  FROM public.agencies a
  WHERE a.id = _agency_id
    AND auth.uid() IS NOT NULL
    AND (a.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
$$;
REVOKE ALL ON FUNCTION public.get_agency_private(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agency_private(uuid) TO authenticated, service_role;

-- 2) JOBS: revoke table-wide SELECT from authenticated, grant only public columns
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum) INTO cols
  FROM pg_attribute
  WHERE attrelid = 'public.jobs'::regclass AND attnum > 0 AND NOT attisdropped
    AND attname NOT IN ('contact_name', 'contact_phone', 'whatsapp');
  EXECUTE 'REVOKE SELECT ON public.jobs FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.jobs TO authenticated', cols);
END $$;

CREATE OR REPLACE FUNCTION public.get_jobs_contacts(_job_ids uuid[] DEFAULT NULL::uuid[])
RETURNS TABLE(id uuid, contact_name text, contact_phone text, whatsapp text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT j.id, j.contact_name, j.contact_phone, j.whatsapp
  FROM public.jobs j
  WHERE auth.uid() IS NOT NULL
    AND (_job_ids IS NULL OR j.id = ANY(_job_ids))
    AND (j.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
$$;
REVOKE ALL ON FUNCTION public.get_jobs_contacts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_jobs_contacts(uuid[]) TO authenticated, service_role;

-- 3) PROFILES: documents unreadable through PostgREST (RPC-only)
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum) INTO cols
  FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped
    AND attname NOT IN ('tax_id', 'tax_id_encrypted');
  EXECUTE 'REVOKE SELECT ON public.profiles FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO authenticated', cols);
END $$;

-- 4) LEADS: anon has no business reading leads (insert only)
REVOKE SELECT ON public.leads FROM anon;
