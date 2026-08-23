-- 1) Categoria nos cliques de contato ------------------------------------
ALTER TABLE public.contact_clicks ADD COLUMN IF NOT EXISTS category_slug text;
CREATE INDEX IF NOT EXISTS idx_contact_clicks_category ON public.contact_clicks (category_slug, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_contact_click(
  _provider_id uuid,
  _contact_type text,
  _page_path text DEFAULT NULL,
  _visitor_id text DEFAULT NULL,
  _category_slug text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_identifier text;
  v_allowed boolean;
BEGIN
  IF _contact_type NOT IN ('whatsapp','phone','profile','email','form') THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = _provider_id AND deleted_at IS NULL) THEN
    RETURN NULL;
  END IF;

  IF _page_path IS NOT NULL AND length(_page_path) > 500 THEN
    _page_path := substring(_page_path, 1, 500);
  END IF;
  IF _visitor_id IS NOT NULL AND length(_visitor_id) > 120 THEN
    _visitor_id := substring(_visitor_id, 1, 120);
  END IF;
  IF _category_slug IS NOT NULL AND length(_category_slug) > 120 THEN
    _category_slug := substring(_category_slug, 1, 120);
  END IF;

  v_identifier := coalesce(auth.uid()::text, _visitor_id, 'anon');
  BEGIN
    v_allowed := public.check_rate_limit('contact_click:' || v_identifier, 60, 60);
    IF NOT coalesce(v_allowed, true) THEN RETURN NULL; END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  INSERT INTO public.contact_clicks (provider_id, contact_type, page_path, visitor_id, category_slug)
  VALUES (_provider_id, _contact_type, _page_path, _visitor_id, _category_slug)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_contact_click(uuid, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.log_contact_click(uuid, text, text, text, text) TO anon, authenticated;

-- 2) Guardas de auto-aprovação -------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_agency_moderation_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_agency_moderation ON public.agencies;
CREATE TRIGGER trg_guard_agency_moderation
BEFORE UPDATE ON public.agencies
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_moderation_columns();

CREATE OR REPLACE FUNCTION public.guard_provider_moderation_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.is_verified := OLD.is_verified;
  NEW.verified_manual := OLD.verified_manual;
  NEW.verified_reason := OLD.verified_reason;
  NEW.community_verified := OLD.community_verified;
  NEW.featured := OLD.featured;
  NEW.plan := OLD.plan;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_provider_moderation ON public.providers;
CREATE TRIGGER trg_guard_provider_moderation
BEFORE UPDATE ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.guard_provider_moderation_columns();

CREATE OR REPLACE FUNCTION public.guard_profile_moderation_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.staff_role := OLD.staff_role;
  NEW.permissions := OLD.permissions;
  NEW.commercial_plan := OLD.commercial_plan;
  NEW.account_type_id := OLD.account_type_id;
  NEW.is_suspicious := OLD.is_suspicious;
  NEW.suspended_at := OLD.suspended_at;
  NEW.suspended_reason := OLD.suspended_reason;
  NEW.banned_at := OLD.banned_at;
  NEW.ban_reason := OLD.ban_reason;
  NEW.tax_id_encrypted := OLD.tax_id_encrypted;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_moderation ON public.profiles;
CREATE TRIGGER trg_guard_profile_moderation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_moderation_columns();