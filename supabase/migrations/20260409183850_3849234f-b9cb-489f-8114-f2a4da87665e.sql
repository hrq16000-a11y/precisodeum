
-- Drop the incorrect trigger on services
DROP TRIGGER IF EXISTS trg_copy_user_ref_services ON public.services;

-- Create a dedicated function for services that uses provider_id
CREATE OR REPLACE FUNCTION public.copy_user_ref_from_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.provider_id IS NOT NULL THEN
    SELECT p.user_ref INTO NEW.user_ref
    FROM providers p
    WHERE p.id = NEW.provider_id;
  END IF;

  IF NEW.user_ref IS NULL THEN
    NEW.user_ref :=
      substr(md5(random()::text), 1, 4) || '-' ||
      substr(md5(random()::text), 1, 4) || '-' ||
      substr(md5(random()::text), 1, 4) || '-' ||
      substr(md5(random()::text), 1, 4);
  END IF;

  RETURN NEW;
END;
$$;

-- Create the correct trigger
CREATE TRIGGER trg_copy_user_ref_services
  BEFORE INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_user_ref_from_provider();
