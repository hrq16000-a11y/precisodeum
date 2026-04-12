CREATE OR REPLACE FUNCTION public.auto_approve_provider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  should_auto boolean;
BEGIN
  SELECT (value = 'true') INTO should_auto
  FROM public.site_settings
  WHERE key = 'auto_approve_providers'
  LIMIT 1;

  IF should_auto IS TRUE
     AND NEW.status = 'pending'
     AND COALESCE(NEW.city, '') <> ''
     AND NEW.city <> 'Não informada'
     AND COALESCE(NEW.state, '') <> ''
  THEN
    NEW.status := 'approved';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_approve_provider_trigger ON public.providers;

CREATE TRIGGER auto_approve_provider_trigger
  BEFORE INSERT ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.auto_approve_provider();