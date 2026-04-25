-- Garante que qualquer UPDATE/INSERT em tabelas com coluna `state`
-- normalize automaticamente para UF de 2 letras (SP, PR, SC...).
-- Isso evita salvar "Santa Catarina", "PARANA", "sp" etc.
CREATE OR REPLACE FUNCTION public.trg_normalize_state_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.state IS NOT NULL THEN
    NEW.state := public.normalize_uf(NEW.state);
  END IF;
  RETURN NEW;
END;
$$;

-- profiles
DROP TRIGGER IF EXISTS trg_normalize_state_profiles ON public.profiles;
CREATE TRIGGER trg_normalize_state_profiles
  BEFORE INSERT OR UPDATE OF state ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_state_column();

-- providers
DROP TRIGGER IF EXISTS trg_normalize_state_providers ON public.providers;
CREATE TRIGGER trg_normalize_state_providers
  BEFORE INSERT OR UPDATE OF state ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_state_column();

-- agencies
DROP TRIGGER IF EXISTS trg_normalize_state_agencies ON public.agencies;
CREATE TRIGGER trg_normalize_state_agencies
  BEFORE INSERT OR UPDATE OF state ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_state_column();

-- jobs
DROP TRIGGER IF EXISTS trg_normalize_state_jobs ON public.jobs;
CREATE TRIGGER trg_normalize_state_jobs
  BEFORE INSERT OR UPDATE OF state ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_state_column();

-- Backfill: normaliza valores existentes de uma vez.
UPDATE public.profiles  SET state = public.normalize_uf(state) WHERE state IS NOT NULL AND state <> COALESCE(public.normalize_uf(state), state);
UPDATE public.providers SET state = public.normalize_uf(state) WHERE state IS NOT NULL AND state <> COALESCE(public.normalize_uf(state), state);
UPDATE public.agencies  SET state = public.normalize_uf(state) WHERE state IS NOT NULL AND state <> COALESCE(public.normalize_uf(state), state);
UPDATE public.jobs      SET state = public.normalize_uf(state) WHERE state IS NOT NULL AND state <> COALESCE(public.normalize_uf(state), state);