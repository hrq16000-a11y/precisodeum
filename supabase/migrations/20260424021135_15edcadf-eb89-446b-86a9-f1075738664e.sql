-- 1. Add view_count column to services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- 2. Index for provider-based ranking by views
CREATE INDEX IF NOT EXISTS idx_services_provider_view_count
  ON public.services USING btree (provider_id, view_count DESC);

-- 3. Drop pre-existing version (parameter name differs) and recreate
DROP FUNCTION IF EXISTS public.increment_service_view(uuid);

CREATE FUNCTION public.increment_service_view(p_service_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.services
     SET view_count = view_count + 1
   WHERE id = p_service_id;
$$;

-- 4. Restrict execution to authenticated users only
REVOKE ALL ON FUNCTION public.increment_service_view(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_service_view(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_service_view(uuid) TO authenticated;