-- Drop função antiga (assinatura conflitante)
DROP FUNCTION IF EXISTS public.derive_user_ref(uuid) CASCADE;

-- 1) Função determinística para derivar user_ref a partir de um UUID
CREATE OR REPLACE FUNCTION public.derive_user_ref(_uuid uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT substr(md5(_uuid::text), 1, 4) || '-' ||
         substr(md5(_uuid::text), 5, 4) || '-' ||
         substr(md5(_uuid::text), 9, 4) || '-' ||
         substr(md5(_uuid::text), 13, 4);
$$;

-- 2) Trigger determinístico para profiles
CREATE OR REPLACE FUNCTION public.trg_set_user_ref_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_ref IS NULL OR NEW.user_ref = '' THEN
    NEW.user_ref := public.derive_user_ref(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_user_ref ON public.profiles;
DROP TRIGGER IF EXISTS set_user_ref_on_profile ON public.profiles;
DROP TRIGGER IF EXISTS trg_set_user_ref_profiles ON public.profiles;

CREATE TRIGGER trg_set_user_ref_profiles
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_user_ref_profiles();

-- 3) Trigger para sponsors
CREATE OR REPLACE FUNCTION public.trg_set_user_ref_sponsors()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.user_ref IS NULL OR NEW.user_ref = '') AND NEW.user_id IS NOT NULL THEN
    SELECT pr.user_ref INTO NEW.user_ref
    FROM public.profiles pr
    WHERE pr.id = NEW.user_id;

    IF NEW.user_ref IS NULL THEN
      NEW.user_ref := public.derive_user_ref(NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_user_ref_sponsors ON public.sponsors;

CREATE TRIGGER trg_set_user_ref_sponsors
BEFORE INSERT OR UPDATE ON public.sponsors
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_user_ref_sponsors();

-- 4) Backfill
UPDATE public.sponsors s
SET user_ref = COALESCE(
  (SELECT pr.user_ref FROM public.profiles pr WHERE pr.id = s.user_id),
  public.derive_user_ref(s.user_id)
)
WHERE s.user_ref IS NULL AND s.user_id IS NOT NULL;

UPDATE public.agencies a
SET user_ref = COALESCE(
  (SELECT pr.user_ref FROM public.profiles pr WHERE pr.id = a.user_id),
  public.derive_user_ref(a.user_id)
)
WHERE a.user_ref IS NULL AND a.user_id IS NOT NULL;