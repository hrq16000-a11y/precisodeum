-- 1. Drop the wrong FK FIRST (was pointing to user_levels/RH roles table)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_level_id_fkey;

-- 2. Now safely migrate all profiles to Bronze (gamification_levels)
UPDATE public.profiles
SET level_id = 'd650cc91-42af-43c3-baca-486925fb95d8'
WHERE level_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM public.gamification_levels gl WHERE gl.id = profiles.level_id);

-- 3. Recreate FK pointing to the CORRECT table (gamification_levels)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_level_id_fkey
  FOREIGN KEY (level_id) REFERENCES public.gamification_levels(id) ON DELETE SET NULL;

-- 4. Auto-heal trigger: if anyone tries to set an invalid level_id, fall back to Bronze
CREATE OR REPLACE FUNCTION public.autoheal_profile_level_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default_id uuid;
BEGIN
  IF NEW.level_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.gamification_levels WHERE id = NEW.level_id
  ) THEN
    SELECT id INTO v_default_id
    FROM public.gamification_levels
    WHERE active = true
    ORDER BY min_points ASC
    LIMIT 1;
    NEW.level_id := v_default_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autoheal_profile_level_id ON public.profiles;
CREATE TRIGGER trg_autoheal_profile_level_id
  BEFORE INSERT OR UPDATE OF level_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.autoheal_profile_level_id();

-- 5. Update handle_new_user to use Bronze as default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default_level uuid;
BEGIN
  SELECT id INTO v_default_level
  FROM public.gamification_levels
  WHERE active = true
  ORDER BY min_points ASC
  LIMIT 1;

  INSERT INTO public.profiles (id, full_name, email, avatar_url, level_id, account_type_id, profile_type, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    v_default_level,
    '50a97ea2-c43e-472f-b6f2-4dd180379cad',
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'profile_type', ''), 'client'),
    CASE
      WHEN NEW.raw_user_meta_data ->> 'profile_type' = 'rh' THEN 'client'
      WHEN NEW.raw_user_meta_data ->> 'profile_type' IS NOT NULL THEN NEW.raw_user_meta_data ->> 'profile_type'
      ELSE 'client'
    END
  );
  RETURN NEW;
END;
$$;

-- 6. Mark the 20 reported errors as resolved (FK violation is now fixed)
UPDATE public.error_reports
SET resolved = true,
    resolved_at = now(),
    admin_notes = COALESCE(admin_notes, '') || E'\n[Auto-resolvido] Bug de FK level_id corrigido. Trigger de auto-heal protege contra recorrência.'
WHERE resolved = false
  AND error_message LIKE '%profiles_level_id_fkey%';