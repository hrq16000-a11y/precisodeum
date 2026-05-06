
CREATE OR REPLACE FUNCTION public.auto_approve_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    IF EXISTS (
      SELECT 1 FROM public.site_settings 
      WHERE key = 'auto_approve_providers' AND value = 'true'
    ) THEN
      NEW.status := 'approved';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_approve_provider
  BEFORE INSERT ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_provider();
