CREATE OR REPLACE FUNCTION public.auto_migrate_profile_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_service_count integer;
  v_current_type text;
  v_fixed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT p.user_id INTO v_user_id FROM providers p WHERE p.id = OLD.provider_id;
  ELSE
    SELECT p.user_id INTO v_user_id FROM providers p WHERE p.id = NEW.provider_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT profile_type,
         COALESCE((SELECT true FROM public.site_settings WHERE key = 'locked_profile_' || v_user_id::text LIMIT 1), false)
  INTO v_current_type, v_fixed
  FROM profiles WHERE id = v_user_id;

  IF v_current_type IS NULL OR v_fixed THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO v_service_count
  FROM services s
  JOIN providers pr ON pr.id = s.provider_id
  WHERE pr.user_id = v_user_id;

  IF TG_OP = 'DELETE' THEN
    v_service_count := v_service_count - 1;
  END IF;

  IF v_current_type = 'rh' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_service_count > 0 AND v_current_type = 'client' THEN
    UPDATE profiles SET profile_type = 'provider', role = 'provider' WHERE id = v_user_id;
  ELSIF v_service_count = 0 AND v_current_type = 'provider' THEN
    UPDATE profiles SET profile_type = 'client', role = 'client' WHERE id = v_user_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;