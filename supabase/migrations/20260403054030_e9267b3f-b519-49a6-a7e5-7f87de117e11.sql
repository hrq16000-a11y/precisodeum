
-- Auto-set + immutability triggers for providers
CREATE TRIGGER trg_set_user_ref_providers
  BEFORE INSERT ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_ref();

CREATE TRIGGER trg_prevent_user_ref_update_providers
  BEFORE UPDATE ON public.providers
  FOR EACH ROW
  WHEN (OLD.user_ref IS NOT NULL)
  EXECUTE FUNCTION public.prevent_user_ref_update();

-- Auto-set + immutability triggers for leads
CREATE TRIGGER trg_set_user_ref_leads
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_ref();

CREATE TRIGGER trg_prevent_user_ref_update_leads
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  WHEN (OLD.user_ref IS NOT NULL)
  EXECUTE FUNCTION public.prevent_user_ref_update();

-- Auto-set + immutability triggers for services
CREATE TRIGGER trg_set_user_ref_services
  BEFORE INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_ref();

CREATE TRIGGER trg_prevent_user_ref_update_services
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  WHEN (OLD.user_ref IS NOT NULL)
  EXECUTE FUNCTION public.prevent_user_ref_update();

-- Auto-set + immutability triggers for provider_page_settings
CREATE TRIGGER trg_set_user_ref_pps
  BEFORE INSERT ON public.provider_page_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_ref();

CREATE TRIGGER trg_prevent_user_ref_update_pps
  BEFORE UPDATE ON public.provider_page_settings
  FOR EACH ROW
  WHEN (OLD.user_ref IS NOT NULL)
  EXECUTE FUNCTION public.prevent_user_ref_update();

-- Make user_ref NOT NULL on profiles
ALTER TABLE public.profiles ALTER COLUMN user_ref SET NOT NULL;
