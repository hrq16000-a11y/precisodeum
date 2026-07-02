
-- 1. Schema additions
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS community_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS community_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_providers_community_verified
  ON public.providers (community_verified) WHERE community_verified = true;

-- 2. Recalculation function for a single provider
CREATE OR REPLACE FUNCTION public.recalc_provider_community_verified(_provider_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider RECORD;
  v_profile RECORD;
  v_account_age_days INT;
  v_onboarding_done BOOLEAN;
  v_has_conversion BOOLEAN;
  v_qualifies BOOLEAN;
BEGIN
  SELECT id, user_id, created_at, community_verified
    INTO v_provider
    FROM public.providers
   WHERE id = _provider_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT id, onboarding_checklist_completed_at
    INTO v_profile
    FROM public.profiles
   WHERE id = v_provider.user_id;

  v_account_age_days := EXTRACT(DAY FROM (now() - v_provider.created_at));
  v_onboarding_done := v_profile.onboarding_checklist_completed_at IS NOT NULL;

  -- Has at least one converted lead OR one whatsapp contact click
  v_has_conversion := EXISTS (
    SELECT 1 FROM public.leads
     WHERE provider_id = v_provider.id AND status = 'converted'
  ) OR EXISTS (
    SELECT 1 FROM public.contact_clicks
     WHERE provider_id = v_provider.id AND contact_type = 'whatsapp'
  );

  v_qualifies := (v_account_age_days >= 30) AND v_onboarding_done AND v_has_conversion;

  IF v_qualifies AND NOT v_provider.community_verified THEN
    UPDATE public.providers
       SET community_verified = true,
           community_verified_at = now()
     WHERE id = v_provider.id;
  ELSIF NOT v_qualifies AND v_provider.community_verified THEN
    UPDATE public.providers
       SET community_verified = false,
           community_verified_at = NULL
     WHERE id = v_provider.id;
  END IF;

  RETURN v_qualifies;
END;
$$;

-- 3. Status function for dashboard (returns the 3 requirement flags)
CREATE OR REPLACE FUNCTION public.get_provider_verification_status(_user_id UUID)
RETURNS TABLE (
  account_age_ok BOOLEAN,
  onboarding_ok BOOLEAN,
  conversion_ok BOOLEAN,
  is_verified BOOLEAN,
  account_age_days INT,
  verified_since TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_provider RECORD;
  v_profile RECORD;
  v_age_days INT;
  v_onb BOOLEAN;
  v_conv BOOLEAN;
BEGIN
  SELECT id, created_at, community_verified, community_verified_at
    INTO v_provider
    FROM public.providers
   WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, false, false, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT onboarding_checklist_completed_at INTO v_profile
    FROM public.profiles WHERE id = _user_id;

  v_age_days := EXTRACT(DAY FROM (now() - v_provider.created_at));
  v_onb := v_profile.onboarding_checklist_completed_at IS NOT NULL;
  v_conv := EXISTS (
    SELECT 1 FROM public.leads WHERE provider_id = v_provider.id AND status = 'converted'
  ) OR EXISTS (
    SELECT 1 FROM public.contact_clicks WHERE provider_id = v_provider.id AND contact_type = 'whatsapp'
  );

  RETURN QUERY SELECT
    (v_age_days >= 30),
    v_onb,
    v_conv,
    v_provider.community_verified,
    v_age_days,
    v_provider.community_verified_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_verification_status(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_provider_community_verified(UUID) TO anon, authenticated;

-- 4. Triggers to auto-refresh on lead conversion / whatsapp click
CREATE OR REPLACE FUNCTION public.trg_refresh_verified_on_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'converted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.recalc_provider_community_verified(NEW.provider_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_refresh_community_verified ON public.leads;
CREATE TRIGGER leads_refresh_community_verified
AFTER INSERT OR UPDATE OF status ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_verified_on_lead();

CREATE OR REPLACE FUNCTION public.trg_refresh_verified_on_click()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_type = 'whatsapp' THEN
    PERFORM public.recalc_provider_community_verified(NEW.provider_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_clicks_refresh_community_verified ON public.contact_clicks;
CREATE TRIGGER contact_clicks_refresh_community_verified
AFTER INSERT ON public.contact_clicks
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_verified_on_click();

-- 5. Backfill existing providers (one-time)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.providers LOOP
    PERFORM public.recalc_provider_community_verified(r.id);
  END LOOP;
END;
$$;
