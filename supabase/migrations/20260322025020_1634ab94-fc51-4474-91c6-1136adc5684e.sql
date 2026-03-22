
-- Update existing phone/whatsapp in providers to canonical 55+DDD format
-- Only update numbers that are 10-11 digits (not yet prefixed with 55)
UPDATE public.providers
SET phone = '55' || phone
WHERE phone ~ '^\d{10,11}$'
  AND phone NOT LIKE '55%';

UPDATE public.providers
SET whatsapp = '55' || whatsapp
WHERE whatsapp ~ '^\d{10,11}$'
  AND whatsapp NOT LIKE '55%';

-- Update the trigger to store canonical 55+DDD format
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
    -- Remove leading zeros
    NEW.whatsapp := REGEXP_REPLACE(NEW.whatsapp, '^0+', '');
    -- Add 55 prefix if 10-11 digits without it
    IF LENGTH(NEW.whatsapp) >= 10 AND LENGTH(NEW.whatsapp) <= 11 AND NEW.whatsapp NOT LIKE '55%' THEN
      NEW.whatsapp := '55' || NEW.whatsapp;
    END IF;
  END IF;

  -- Strip non-digits from phone
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g');
    -- Remove leading zeros
    NEW.phone := REGEXP_REPLACE(NEW.phone, '^0+', '');
    -- Add 55 prefix if 10-11 digits without it
    IF LENGTH(NEW.phone) >= 10 AND LENGTH(NEW.phone) <= 11 AND NEW.phone NOT LIKE '55%' THEN
      NEW.phone := '55' || NEW.phone;
    END IF;
  END IF;

  -- Auto-fill whatsapp from phone if empty
  IF (NEW.whatsapp IS NULL OR NEW.whatsapp = '') AND NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    NEW.whatsapp := NEW.phone;
  END IF;

  RETURN NEW;
END;
$$;
