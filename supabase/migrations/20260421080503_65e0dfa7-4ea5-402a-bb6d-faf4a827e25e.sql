CREATE OR REPLACE FUNCTION public.auto_migrate_profile_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_service_count integer := 0;
  v_current_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT p.user_id INTO v_user_id
    FROM public.providers p
    WHERE p.id = OLD.provider_id;
  ELSE
    SELECT p.user_id INTO v_user_id
    FROM public.providers p
    WHERE p.id = NEW.provider_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*)::int
    INTO v_service_count
  FROM public.services s
  JOIN public.providers p ON p.id = s.provider_id
  WHERE p.user_id = v_user_id
    AND s.deleted_at IS NULL;

  SELECT profile_type
    INTO v_current_type
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_service_count > 0 AND v_current_type IS DISTINCT FROM 'provider' THEN
    UPDATE public.profiles
    SET profile_type = 'provider',
        role = 'provider',
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;