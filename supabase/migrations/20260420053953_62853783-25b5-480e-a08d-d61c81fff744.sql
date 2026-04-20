-- 1) Permitir NULL e remover defaults hardcoded em profile_type/role
ALTER TABLE public.profiles ALTER COLUMN profile_type DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN profile_type DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;

-- 2) Recriar handle_new_user sem hardcode: profile_type/role só são preenchidos se vierem no metadata
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

  -- Só grava profile_type/role se vier explicitamente no metadata; senão, NULL (força ProfileTypeChooser)
  IF v_meta_type IN ('client','provider','rh') THEN
    v_profile_type := v_meta_type;
    v_role := CASE WHEN v_meta_type = 'rh' THEN 'client' ELSE v_meta_type END;
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