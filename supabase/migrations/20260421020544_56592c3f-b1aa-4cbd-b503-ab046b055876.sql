CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_default_level uuid;
  v_meta_type text;
  v_profile_type text;
  v_role text;
BEGIN
  SELECT id INTO v_default_level
  FROM public.gamification_levels
  WHERE active = true
  ORDER BY min_points ASC
  LIMIT 1;

  v_meta_type := NULLIF(NEW.raw_user_meta_data ->> 'profile_type', '');

  IF v_meta_type IN ('client','provider') THEN
    v_profile_type := v_meta_type;
    v_role := v_meta_type;
  ELSE
    v_profile_type := NULL;
    v_role := NULL;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, avatar_url, level_id, account_type_id, profile_type, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    v_default_level,
    '61f51480-d8c2-4c78-8f44-6a17e8b6b968',
    v_profile_type,
    v_role
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_migrate_profile_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_service_count integer := 0;
  v_current_type text;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*)::int
    INTO v_service_count
  FROM public.services
  WHERE user_id = v_user_id
    AND deleted_at IS NULL;

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
$function$;