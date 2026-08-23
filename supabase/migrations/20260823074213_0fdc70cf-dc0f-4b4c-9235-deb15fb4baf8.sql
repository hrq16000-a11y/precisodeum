REVOKE SELECT (whatsapp) ON public.agencies FROM anon;
REVOKE SELECT (whatsapp) ON public.agencies FROM authenticated;

DROP FUNCTION IF EXISTS public.get_agency_private(uuid);
CREATE FUNCTION public.get_agency_private(_agency_id uuid)
RETURNS TABLE(id uuid, cnpj text, email text, legal_name text, whatsapp text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT a.id, a.cnpj, a.email, a.legal_name, a.whatsapp
  FROM public.agencies a
  WHERE a.id = _agency_id
    AND auth.uid() IS NOT NULL
    AND (a.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
$function$;

GRANT EXECUTE ON FUNCTION public.get_agency_private(uuid) TO authenticated;

ALTER TABLE public.category_opportunity_leads
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sponsor_id uuid REFERENCES public.sponsors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS contacted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notes text;

CREATE INDEX IF NOT EXISTS idx_col_status_created
  ON public.category_opportunity_leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_col_category_slug
  ON public.category_opportunity_leads (category_slug);