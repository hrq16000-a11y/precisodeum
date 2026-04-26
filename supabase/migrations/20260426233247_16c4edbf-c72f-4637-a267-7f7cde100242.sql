CREATE OR REPLACE FUNCTION public.providers_preserve_existing_on_partial_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.city := COALESCE(NULLIF(BTRIM(NEW.city), ''), OLD.city, '');
    NEW.state := COALESCE(NULLIF(public.normalize_uf(NEW.state), ''), NULLIF(public.normalize_uf(OLD.state), ''), '');
    NEW.neighborhood := COALESCE(NULLIF(BTRIM(NEW.neighborhood), ''), OLD.neighborhood, '');
    NEW.phone := COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g'), ''), OLD.phone, '');
    NEW.whatsapp := COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(NEW.whatsapp, ''), '[^0-9]', '', 'g'), ''), OLD.whatsapp, '');
    NEW.description := COALESCE(NULLIF(BTRIM(NEW.description), ''), OLD.description, '');
    NEW.account_type := COALESCE(NULLIF(BTRIM(NEW.account_type), ''), OLD.account_type, 'autonomous');
    NEW.legal_name := COALESCE(NULLIF(BTRIM(NEW.legal_name), ''), OLD.legal_name);
    NEW.business_name := COALESCE(NULLIF(BTRIM(NEW.business_name), ''), OLD.business_name);
    NEW.cpf := COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(NEW.cpf, ''), '[^0-9]', '', 'g'), ''), OLD.cpf);
    NEW.cnpj := COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(NEW.cnpj, ''), '[^0-9]', '', 'g'), ''), OLD.cnpj);
  ELSE
    NEW.city := COALESCE(NULLIF(BTRIM(NEW.city), ''), '');
    NEW.state := COALESCE(NULLIF(public.normalize_uf(NEW.state), ''), '');
    NEW.neighborhood := COALESCE(NULLIF(BTRIM(NEW.neighborhood), ''), '');
    NEW.phone := COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g'), ''), '');
    NEW.whatsapp := COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(NEW.whatsapp, ''), '[^0-9]', '', 'g'), ''), NEW.phone, '');
    NEW.description := COALESCE(NULLIF(BTRIM(NEW.description), ''), '');
    NEW.account_type := COALESCE(NULLIF(BTRIM(NEW.account_type), ''), 'autonomous');
    NEW.legal_name := NULLIF(BTRIM(NEW.legal_name), '');
    NEW.business_name := NULLIF(BTRIM(NEW.business_name), '');
    NEW.cpf := NULLIF(REGEXP_REPLACE(COALESCE(NEW.cpf, ''), '[^0-9]', '', 'g'), '');
    NEW.cnpj := NULLIF(REGEXP_REPLACE(COALESCE(NEW.cnpj, ''), '[^0-9]', '', 'g'), '');
  END IF;

  IF (NEW.whatsapp IS NULL OR NEW.whatsapp = '') AND NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    NEW.whatsapp := NEW.phone;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_providers_preserve_existing_on_partial_update ON public.providers;
CREATE TRIGGER trg_providers_preserve_existing_on_partial_update
BEFORE INSERT OR UPDATE ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.providers_preserve_existing_on_partial_update();