ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tax_id text;

-- Validação por trigger (não usar CHECK, conforme padrão do projeto)
CREATE OR REPLACE FUNCTION public.validate_profile_tax_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF NEW.tax_id IS NULL OR NEW.tax_id = '' THEN
    NEW.tax_id := NULL;
    RETURN NEW;
  END IF;

  digits := regexp_replace(NEW.tax_id, '\D', '', 'g');

  IF length(digits) NOT IN (11, 14) THEN
    RAISE EXCEPTION 'tax_id deve conter 11 dígitos (CPF) ou 14 (CNPJ)';
  END IF;

  -- Persiste apenas dígitos (sem máscara)
  NEW.tax_id := digits;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_profile_tax_id ON public.profiles;
CREATE TRIGGER trg_validate_profile_tax_id
  BEFORE INSERT OR UPDATE OF tax_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_tax_id();

CREATE INDEX IF NOT EXISTS idx_profiles_tax_id ON public.profiles(tax_id) WHERE tax_id IS NOT NULL;