-- Trigger BEFORE INSERT/UPDATE em public.providers para blindar contra
-- caller que enviar NULL em colunas NOT NULL com DEFAULT ''.
-- Histórico: o SmartOnboardingWizard enviava description: null quando o
-- usuário pulava a bio, gerando 23502 e abandono do cadastro (vide
-- screenshots em 2026-04-26).
CREATE OR REPLACE FUNCTION public.coalesce_providers_required_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.description := COALESCE(NEW.description, '');
  NEW.city        := COALESCE(NEW.city, '');
  NEW.state       := COALESCE(NEW.state, '');
  NEW.phone       := COALESCE(NEW.phone, '');
  NEW.whatsapp    := COALESCE(NEW.whatsapp, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coalesce_providers_required_fields ON public.providers;
CREATE TRIGGER trg_coalesce_providers_required_fields
  BEFORE INSERT OR UPDATE ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.coalesce_providers_required_fields();