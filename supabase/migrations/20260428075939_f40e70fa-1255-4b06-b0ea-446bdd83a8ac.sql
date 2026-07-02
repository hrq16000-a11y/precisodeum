-- Trigger: preenche neighborhood com 'Centro' quando vier vazio mas houver cidade.
-- Motivo: o badge "Atende no seu bairro" e a UX de proximidade dependem de
-- algum valor de bairro. Cadastros antigos (e wizards minimalistas que não
-- pedem bairro) ficavam com '' e perdiam visibilidade.
CREATE OR REPLACE FUNCTION public.fill_provider_neighborhood_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Só age se cidade existir E bairro vier vazio/nulo.
  IF (NEW.city IS NOT NULL AND length(btrim(NEW.city)) > 0)
     AND (NEW.neighborhood IS NULL OR length(btrim(NEW.neighborhood)) = 0) THEN
    NEW.neighborhood := 'Centro';
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear o save por causa do default.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_provider_neighborhood_default ON public.providers;
CREATE TRIGGER trg_fill_provider_neighborhood_default
  BEFORE INSERT OR UPDATE OF city, neighborhood
  ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_provider_neighborhood_default();

-- Backfill: preenche os existentes sem bairro mas com cidade.
UPDATE public.providers
SET neighborhood = 'Centro'
WHERE (neighborhood IS NULL OR length(btrim(neighborhood)) = 0)
  AND city IS NOT NULL
  AND length(btrim(city)) > 0;