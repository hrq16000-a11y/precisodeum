-- Passo 1: RPC segura para o próprio prestador ler seus dados (incluindo PII)
CREATE OR REPLACE FUNCTION public.get_my_provider_details()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  business_name text,
  legal_name text,
  cpf text,
  cnpj text,
  city text,
  state text,
  neighborhood text,
  working_hours_struct jsonb,
  status text,
  account_type text,
  slug text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: autenticação obrigatória' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.business_name,
    p.legal_name,
    p.cpf,
    p.cnpj,
    p.city,
    p.state,
    p.neighborhood,
    p.working_hours_struct,
    p.status,
    p.account_type,
    p.slug
  FROM public.providers p
  WHERE p.user_id = v_caller
    AND p.deleted_at IS NULL
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_provider_details() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_provider_details() TO authenticated;

-- Passo 3: Blindagem da tabela profiles — REVOKE em colunas sensíveis
REVOKE SELECT (tax_id, suspicious_ip) ON public.profiles FROM anon;
REVOKE SELECT (tax_id, suspicious_ip) ON public.profiles FROM authenticated;