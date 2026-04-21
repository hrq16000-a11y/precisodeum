CREATE OR REPLACE FUNCTION public.audit_service_insert_user_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_provider record;
  v_actor uuid;
  v_user_ref text;
BEGIN
  SELECT id, user_id, user_ref
    INTO v_provider
    FROM public.providers
   WHERE id = NEW.provider_id;

  v_actor := COALESCE(auth.uid(), v_provider.user_id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_user_ref := COALESCE(NEW.user_ref, v_provider.user_ref);

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    v_actor,
    'service_insert_audit',
    'service',
    NEW.id::text,
    jsonb_build_object(
      'provider_id', NEW.provider_id,
      'user_ref', v_user_ref,
      'service_name', NEW.service_name,
      'category_id', NEW.category_id,
      'source', 'services_after_insert'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'audit_service_insert_user_ref failed for service %, provider %, user_ref %, error %', NEW.id, NEW.provider_id, NEW.user_ref, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_service_insert_user_ref ON public.services;
CREATE TRIGGER trg_audit_service_insert_user_ref
AFTER INSERT ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.audit_service_insert_user_ref();

CREATE OR REPLACE FUNCTION public.auto_migrate_profile_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_provider_id uuid;
  v_user_ref text;
  v_service_count integer := 0;
  v_current_type text;
  v_migrated boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_provider_id := OLD.provider_id;
  ELSE
    v_provider_id := NEW.provider_id;
  END IF;

  SELECT p.user_id, p.user_ref
    INTO v_user_id, v_user_ref
    FROM public.providers p
   WHERE p.id = v_provider_id;

  IF v_user_id IS NULL THEN
    RAISE LOG 'auto_migrate_profile_type skipped: provider %, user_ref %, op %', v_provider_id, v_user_ref, TG_OP;
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
    v_migrated := true;
  END IF;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    COALESCE(auth.uid(), v_user_id),
    'auto_migrate_profile_type_audit',
    'profile',
    v_user_id::text,
    jsonb_build_object(
      'provider_id', v_provider_id,
      'user_ref', v_user_ref,
      'service_count', v_service_count,
      'previous_profile_type', v_current_type,
      'migrated_to_provider', v_migrated,
      'trigger_op', TG_OP,
      'service_id', COALESCE(NEW.id, OLD.id)
    )
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_migrate_profile_type failed: provider %, user_ref %, op %, error %', v_provider_id, v_user_ref, TG_OP, SQLERRM;
  RAISE;
END;
$$;