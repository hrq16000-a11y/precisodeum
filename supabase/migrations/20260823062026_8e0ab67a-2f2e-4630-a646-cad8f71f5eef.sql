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
  NEW.role := OLD.role;
  NEW.status := OLD.status;
  NEW.staff_role := OLD.staff_role;
  NEW.permissions := OLD.permissions;
  NEW.commercial_plan := OLD.commercial_plan;
  NEW.account_type_id := OLD.account_type_id;
  NEW.is_suspicious := OLD.is_suspicious;
  NEW.suspicious_at := OLD.suspicious_at;
  NEW.suspicious_ip := OLD.suspicious_ip;
  NEW.suspicious_reason := OLD.suspicious_reason;
  NEW.suspended_at := OLD.suspended_at;
  NEW.suspended_by := OLD.suspended_by;
  NEW.suspended_reason := OLD.suspended_reason;
  NEW.banned_at := OLD.banned_at;
  NEW.ban_reason := OLD.ban_reason;
  NEW.trial_boost_until := OLD.trial_boost_until;
  NEW.tax_id_encrypted := OLD.tax_id_encrypted;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_moderation ON public.profiles;
CREATE TRIGGER trg_guard_profile_moderation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_moderation_columns();

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
  NEW.verified_at := OLD.verified_at;
  NEW.verified_by := OLD.verified_by;
  NEW.verified_criteria := OLD.verified_criteria;
  NEW.community_verified := OLD.community_verified;
  NEW.community_verified_at := OLD.community_verified_at;
  NEW.featured := OLD.featured;
  NEW.plan := OLD.plan;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_provider_moderation ON public.providers;
CREATE TRIGGER trg_guard_provider_moderation
BEFORE UPDATE ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.guard_provider_moderation_columns();