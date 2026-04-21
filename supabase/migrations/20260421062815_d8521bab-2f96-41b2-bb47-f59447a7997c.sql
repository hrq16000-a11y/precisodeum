CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_level uuid;
BEGIN
  SELECT id INTO v_default_level
  FROM public.gamification_levels
  WHERE active = true
  ORDER BY min_points ASC
  LIMIT 1;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    avatar_url,
    level_id,
    account_type_id,
    profile_type,
    role,
    onboarding_completed
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    v_default_level,
    '61f51480-d8c2-4c78-8f44-6a17e8b6b968',
    NULL,
    NULL,
    false
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_set_user_ref_sponsors()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_ref IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.user_ref := public.derive_user_ref(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_user_ref ON public.sponsors;
DROP TRIGGER IF EXISTS trg_set_sponsor_user_ref ON public.sponsors;
DROP TRIGGER IF EXISTS trg_set_user_ref_sponsors ON public.sponsors;

CREATE TRIGGER trg_set_user_ref
BEFORE INSERT OR UPDATE OF user_id, user_ref ON public.sponsors
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_user_ref_sponsors();

UPDATE public.sponsors
SET user_ref = public.derive_user_ref(user_id)
WHERE user_id IS NOT NULL
  AND user_ref IS NULL;