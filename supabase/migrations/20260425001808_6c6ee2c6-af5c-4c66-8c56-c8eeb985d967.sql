CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;

-- Recria a função apontando para o schema correto.
CREATE OR REPLACE FUNCTION public.search_cities(term text)
RETURNS TABLE (
  id uuid,
  name text,
  state text,
  state_uf text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
  SELECT c.id, c.name, c.state, c.state_uf
  FROM public.cities c
  WHERE term IS NOT NULL
    AND length(btrim(term)) >= 2
    AND extensions.unaccent(lower(c.name)) LIKE extensions.unaccent(lower(btrim(term))) || '%'
  ORDER BY c.name ASC
  LIMIT 20;
$$;

GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_cities(text) TO anon, authenticated;