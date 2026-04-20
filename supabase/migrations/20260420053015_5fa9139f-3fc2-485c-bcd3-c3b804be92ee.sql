CREATE OR REPLACE FUNCTION public.auto_approve_rh_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_type text;
BEGIN
  SELECT profile_type INTO v_profile_type FROM public.profiles WHERE id = NEW.user_id;
  IF v_profile_type = 'rh' THEN
    NEW.approval_status := 'approved';
    IF NEW.status IS NULL OR NEW.status = 'pending' THEN
      NEW.status := 'open';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_approve_rh_jobs ON public.jobs;
CREATE TRIGGER trg_auto_approve_rh_jobs
BEFORE INSERT ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.auto_approve_rh_jobs();