-- Onda 6: coluna gerada city_normalized para filtro server-side accent-insensitive
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS city_normalized text
  GENERATED ALWAYS AS (public.immutable_unaccent(lower(city))) STORED;

CREATE INDEX IF NOT EXISTS idx_providers_city_normalized
  ON public.providers (city_normalized);

-- Remove índice funcional anterior (redundante com a coluna gerada)
DROP INDEX IF EXISTS public.idx_providers_city_unaccent;