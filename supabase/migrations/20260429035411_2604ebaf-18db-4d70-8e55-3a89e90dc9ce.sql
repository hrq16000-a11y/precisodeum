CREATE OR REPLACE FUNCTION public.fill_provider_business_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_name text;
BEGIN
  IF NEW.business_name IS NULL OR btrim(NEW.business_name) = '' THEN
    IF NEW.legal_name IS NOT NULL AND btrim(NEW.legal_name) <> '' THEN
      NEW.business_name := btrim(NEW.legal_name);
    ELSE
      SELECT NULLIF(btrim(full_name), '')
        INTO v_profile_name
      FROM public.profiles
      WHERE id = NEW.user_id
      LIMIT 1;
      IF v_profile_name IS NOT NULL THEN
        NEW.business_name := v_profile_name;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_provider_business_name ON public.providers;
CREATE TRIGGER trg_fill_provider_business_name
BEFORE INSERT OR UPDATE OF business_name, legal_name ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.fill_provider_business_name();

UPDATE public.providers p
SET business_name = COALESCE(
  NULLIF(btrim(p.legal_name), ''),
  NULLIF(btrim(pr.full_name), '')
)
FROM public.profiles pr
WHERE pr.id = p.user_id
  AND (p.business_name IS NULL OR btrim(p.business_name) = '')
  AND COALESCE(NULLIF(btrim(p.legal_name), ''),
               NULLIF(btrim(pr.full_name), '')) IS NOT NULL;