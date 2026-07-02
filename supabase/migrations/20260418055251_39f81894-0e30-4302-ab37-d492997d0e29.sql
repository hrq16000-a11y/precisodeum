-- Attach autoheal trigger to prevent FK violations on profiles.level_id
DROP TRIGGER IF EXISTS trg_autoheal_profile_level_id ON public.profiles;
CREATE TRIGGER trg_autoheal_profile_level_id
BEFORE INSERT OR UPDATE OF level_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.autoheal_profile_level_id();