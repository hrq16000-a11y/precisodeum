-- RPCs de agregação para substituir queries .limit(1000) em useProviders.tsx
-- Evita truncamento silencioso de contadores de categoria e ranking por proximidade
-- quando o número de providers aprovados crescer.

CREATE OR REPLACE FUNCTION public.get_categories_with_provider_count()
RETURNS TABLE (category_id uuid, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.category_id, COUNT(*)::bigint AS count
  FROM public.providers p
  WHERE p.status = 'approved'
    AND p.category_id IS NOT NULL
  GROUP BY p.category_id;
$$;

CREATE OR REPLACE FUNCTION public.get_geo_categories()
RETURNS TABLE (
  category_id uuid,
  count bigint,
  avg_lat double precision,
  avg_lng double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.category_id,
    COUNT(*)::bigint AS count,
    AVG(p.latitude)::double precision AS avg_lat,
    AVG(p.longitude)::double precision AS avg_lng
  FROM public.providers p
  WHERE p.status = 'approved'
    AND p.category_id IS NOT NULL
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
  GROUP BY p.category_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_categories_with_provider_count() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_geo_categories() TO anon, authenticated, service_role;