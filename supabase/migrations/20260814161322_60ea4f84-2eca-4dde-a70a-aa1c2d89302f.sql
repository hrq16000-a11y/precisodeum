-- 1) Corta a leitura direta de contato para visitantes anônimos
REVOKE SELECT (phone, whatsapp) ON public.providers FROM anon;

-- 2) Revelação sob demanda, com guarda explícita
CREATE OR REPLACE FUNCTION public.get_provider_contact(_provider_id uuid)
RETURNS TABLE (phone text, whatsapp text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _provider_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.phone, p.whatsapp
  FROM public.providers p
  WHERE p.id = _provider_id
    AND p.deleted_at IS NULL
    AND (
      p.status = 'approved'
      OR p.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_provider_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_provider_contact(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_contact(uuid) TO service_role;