
CREATE OR REPLACE FUNCTION public.clean_city_input()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.city IS NOT NULL AND NEW.city != '' THEN
    NEW.city := INITCAP(TRIM(NEW.city));
  END IF;
  IF NEW.state IS NOT NULL AND NEW.state != '' THEN
    NEW.state := UPPER(TRIM(NEW.state));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_clean_provider_city
BEFORE INSERT OR UPDATE ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.clean_city_input();
