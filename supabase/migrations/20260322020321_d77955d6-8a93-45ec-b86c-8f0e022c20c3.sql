
-- Trigger to auto-sanitize whatsapp and phone on insert/update
CREATE OR REPLACE FUNCTION public.sanitize_provider_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Strip non-digits from whatsapp
  IF NEW.whatsapp IS NOT NULL THEN
    NEW.whatsapp := REGEXP_REPLACE(NEW.whatsapp, '[^0-9]', '', 'g');
  END IF;
  -- Strip non-digits from phone
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g');
  END IF;
  -- Auto-fill whatsapp from phone if empty
  IF (NEW.whatsapp IS NULL OR NEW.whatsapp = '') AND NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    NEW.whatsapp := NEW.phone;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sanitize_provider_phone
  BEFORE INSERT OR UPDATE ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_provider_phone();
