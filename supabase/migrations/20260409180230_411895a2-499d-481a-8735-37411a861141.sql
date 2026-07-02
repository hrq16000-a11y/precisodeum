
-- 1. Update handle_new_user() to read profile_type from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, level_id, account_type_id, profile_type, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    '716c417b-fdc8-4121-879b-abcd8f0a216f',
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

-- 2. Fix RLS policy to allow users to change their own profile_type and role
DROP POLICY "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
