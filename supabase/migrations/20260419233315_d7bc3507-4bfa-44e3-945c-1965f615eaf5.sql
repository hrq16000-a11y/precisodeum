-- Revoga acesso direto da MV via API REST (corrige aviso "Materialized View in API")
REVOKE SELECT ON public.featured_providers_mv FROM anon, authenticated;

-- Função pública wrapper para acesso controlado (mesmos dados, sem expor a MV)
CREATE OR REPLACE FUNCTION public.get_featured_providers(_limit integer DEFAULT 12)
RETURNS SETOF public.featured_providers_mv
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.featured_providers_mv
  ORDER BY rating_avg DESC NULLS LAST, review_count DESC NULLS LAST
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_featured_providers(integer) TO anon, authenticated;