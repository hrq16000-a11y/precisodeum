CREATE OR REPLACE FUNCTION public.increment_service_view(service_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.services SET view_count = view_count + 1 WHERE id = service_id;
$$;