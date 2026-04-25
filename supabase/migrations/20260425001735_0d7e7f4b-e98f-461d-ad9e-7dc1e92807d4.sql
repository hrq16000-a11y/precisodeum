-- Habilita unaccent (idempotente). Schema padrão funciona para a função abaixo.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- RPC para busca de cidades insensível a acentos e caixa.
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
    AND unaccent(lower(c.name)) LIKE unaccent(lower(btrim(term))) || '%'
  ORDER BY c.name ASC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_cities(text) TO anon, authenticated;