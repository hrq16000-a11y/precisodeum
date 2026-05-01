-- Helper: detect "empty" text (NULL or only whitespace)
CREATE OR REPLACE FUNCTION public._is_blank_text(v text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR btrim(v) = ''
$$;

-- =========================================================
-- Trigger function: protect SERVICES from blank overwrites
-- =========================================================
CREATE OR REPLACE FUNCTION public.guard_services_blank_overwrite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  blocked jsonb := '{}'::jsonb;
BEGIN
  -- service_name (NOT NULL, but could become empty string)
  IF public._is_blank_text(NEW.service_name) AND NOT public._is_blank_text(OLD.service_name) THEN
    NEW.service_name := OLD.service_name;
    blocked := blocked || jsonb_build_object('service_name', OLD.service_name);
  END IF;

  IF public._is_blank_text(NEW.description) AND NOT public._is_blank_text(OLD.description) THEN
    NEW.description := OLD.description;
    blocked := blocked || jsonb_build_object('description', OLD.description);
  END IF;

  IF public._is_blank_text(NEW.service_area) AND NOT public._is_blank_text(OLD.service_area) THEN
    NEW.service_area := OLD.service_area;
    blocked := blocked || jsonb_build_object('service_area', OLD.service_area);
  END IF;

  IF public._is_blank_text(NEW.whatsapp) AND NOT public._is_blank_text(OLD.whatsapp) THEN
    NEW.whatsapp := OLD.whatsapp;
    blocked := blocked || jsonb_build_object('whatsapp', OLD.whatsapp);
  END IF;

  IF public._is_blank_text(NEW.address) AND NOT public._is_blank_text(OLD.address) THEN
    NEW.address := OLD.address;
    blocked := blocked || jsonb_build_object('address', OLD.address);
  END IF;

  IF public._is_blank_text(NEW.working_hours) AND NOT public._is_blank_text(OLD.working_hours) THEN
    NEW.working_hours := OLD.working_hours;
    blocked := blocked || jsonb_build_object('working_hours', OLD.working_hours);
  END IF;

  -- category_id (uuid)
  IF NEW.category_id IS NULL AND OLD.category_id IS NOT NULL THEN
    NEW.category_id := OLD.category_id;
    blocked := blocked || jsonb_build_object('category_id', OLD.category_id);
  END IF;

  -- Audit if anything was blocked
  IF blocked <> '{}'::jsonb THEN
    BEGIN
      INSERT INTO public.system_audit_logs (actor_id, action, target_type, target_id, metadata)
      VALUES (
        auth.uid(),
        'review_overwrite_blocked',
        'service',
        NEW.id,
        jsonb_build_object('blocked_fields', blocked, 'table', 'services')
      );
    EXCEPTION WHEN others THEN
      -- Audit failure must never break the user update
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_services_blank_overwrite ON public.services;
CREATE TRIGGER trg_guard_services_blank_overwrite
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.guard_services_blank_overwrite();

-- =========================================================
-- Trigger function: protect PROVIDERS from blank overwrites
-- =========================================================
CREATE OR REPLACE FUNCTION public.guard_providers_blank_overwrite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  blocked jsonb := '{}'::jsonb;
BEGIN
  IF public._is_blank_text(NEW.business_name) AND NOT public._is_blank_text(OLD.business_name) THEN
    NEW.business_name := OLD.business_name;
    blocked := blocked || jsonb_build_object('business_name', OLD.business_name);
  END IF;

  IF public._is_blank_text(NEW.description) AND NOT public._is_blank_text(OLD.description) THEN
    NEW.description := OLD.description;
    blocked := blocked || jsonb_build_object('description', OLD.description);
  END IF;

  IF public._is_blank_text(NEW.photo_url) AND NOT public._is_blank_text(OLD.photo_url) THEN
    NEW.photo_url := OLD.photo_url;
    blocked := blocked || jsonb_build_object('photo_url', OLD.photo_url);
  END IF;

  IF public._is_blank_text(NEW.city) AND NOT public._is_blank_text(OLD.city) THEN
    NEW.city := OLD.city;
    blocked := blocked || jsonb_build_object('city', OLD.city);
  END IF;

  IF public._is_blank_text(NEW.state) AND NOT public._is_blank_text(OLD.state) THEN
    NEW.state := OLD.state;
    blocked := blocked || jsonb_build_object('state', OLD.state);
  END IF;

  IF public._is_blank_text(NEW.neighborhood) AND NOT public._is_blank_text(OLD.neighborhood) THEN
    NEW.neighborhood := OLD.neighborhood;
    blocked := blocked || jsonb_build_object('neighborhood', OLD.neighborhood);
  END IF;

  IF public._is_blank_text(NEW.phone) AND NOT public._is_blank_text(OLD.phone) THEN
    NEW.phone := OLD.phone;
    blocked := blocked || jsonb_build_object('phone', OLD.phone);
  END IF;

  IF public._is_blank_text(NEW.whatsapp) AND NOT public._is_blank_text(OLD.whatsapp) THEN
    NEW.whatsapp := OLD.whatsapp;
    blocked := blocked || jsonb_build_object('whatsapp', OLD.whatsapp);
  END IF;

  IF NEW.category_id IS NULL AND OLD.category_id IS NOT NULL THEN
    NEW.category_id := OLD.category_id;
    blocked := blocked || jsonb_build_object('category_id', OLD.category_id);
  END IF;

  IF blocked <> '{}'::jsonb THEN
    BEGIN
      INSERT INTO public.system_audit_logs (actor_id, action, target_type, target_id, metadata)
      VALUES (
        auth.uid(),
        'review_overwrite_blocked',
        'provider',
        NEW.id,
        jsonb_build_object('blocked_fields', blocked, 'table', 'providers')
      );
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_providers_blank_overwrite ON public.providers;
CREATE TRIGGER trg_guard_providers_blank_overwrite
BEFORE UPDATE ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.guard_providers_blank_overwrite();