-- Função pública para formatar cidade/estado de forma consistente com o frontend.
-- Usa public.normalize_uf (já existente) para garantir que apenas UFs válidas saem.
CREATE OR REPLACE FUNCTION public.format_city_state(_city text, _state text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _city IS NULL OR btrim(_city) = '' THEN NULL
    WHEN public.normalize_uf(_state) IS NULL THEN btrim(_city)
    ELSE btrim(_city) || ' - ' || public.normalize_uf(_state)
  END;
$$;

COMMENT ON FUNCTION public.format_city_state(text, text) IS
  'Single source of truth no banco para "Cidade - UF". Espelha o frontend formatCityState().';

-- Bairro opcional já existe em profiles (migração anterior). Garante presença em providers também.
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS neighborhood text;
