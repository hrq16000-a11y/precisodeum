-- Saneamento do bug "ST" em providers.state
-- Inferir UF correta usando a tabela cities (match por nome de cidade)
UPDATE public.providers p
SET state = c.state_uf
FROM public.cities c
WHERE p.state = 'ST'
  AND c.name = p.city
  AND c.state_uf IS NOT NULL
  AND length(c.state_uf) = 2;

-- Para registros restantes (cidade sem match ou ambígua): zerar 'ST' inválido
UPDATE public.providers
SET state = NULL
WHERE state = 'ST';

-- Trigger defensiva: rejeita state inválido (deve ter exatamente 2 letras maiúsculas A-Z, ou NULL)
CREATE OR REPLACE FUNCTION public.validate_provider_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.state IS NOT NULL THEN
    NEW.state := upper(trim(NEW.state));
    IF NEW.state !~ '^[A-Z]{2}$' OR NEW.state = 'ST' THEN
      NEW.state := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_provider_state ON public.providers;
CREATE TRIGGER trg_validate_provider_state
BEFORE INSERT OR UPDATE OF state ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.validate_provider_state();