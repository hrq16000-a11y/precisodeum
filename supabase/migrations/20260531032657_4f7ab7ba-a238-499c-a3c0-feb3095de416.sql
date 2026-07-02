CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
SET search_path = public, extensions
AS $$
  SELECT extensions.unaccent('extensions.unaccent', $1)
$$;

CREATE INDEX IF NOT EXISTS idx_providers_city_unaccent
  ON public.providers (public.immutable_unaccent(lower(city)));