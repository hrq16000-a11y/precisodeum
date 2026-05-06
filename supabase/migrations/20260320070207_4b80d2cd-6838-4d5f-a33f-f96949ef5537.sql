
-- 1. Trigger: auto-migrate profile_type based on service count
CREATE OR REPLACE FUNCTION public.auto_migrate_profile_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_service_count integer;
  v_current_type text;
  v_fixed boolean;
BEGIN
  -- Get the user_id from the provider
  IF TG_OP = 'DELETE' THEN
    SELECT p.user_id INTO v_user_id FROM providers p WHERE p.id = OLD.provider_id;
  ELSE
    SELECT p.user_id INTO v_user_id FROM providers p WHERE p.id = NEW.provider_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Check if profile_type is locked by admin
  SELECT profile_type, COALESCE((SELECT true FROM public.site_settings WHERE key = 'locked_profile_' || v_user_id::text LIMIT 1), false)
  INTO v_current_type, v_fixed;

  IF v_fixed THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Count services for this user
  SELECT COUNT(*) INTO v_service_count
  FROM services s
  JOIN providers pr ON pr.id = s.provider_id
  WHERE pr.user_id = v_user_id;

  -- Adjust count for the current operation
  IF TG_OP = 'INSERT' THEN
    v_service_count := v_service_count; -- already counted
  ELSIF TG_OP = 'DELETE' THEN
    v_service_count := v_service_count - 1;
  END IF;

  -- Don't downgrade RH users
  IF v_current_type = 'rh' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Migrate
  IF v_service_count > 0 AND v_current_type = 'client' THEN
    UPDATE profiles SET profile_type = 'provider', role = 'provider' WHERE id = v_user_id;
  ELSIF v_service_count = 0 AND v_current_type = 'provider' THEN
    UPDATE profiles SET profile_type = 'client', role = 'client' WHERE id = v_user_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers on services table
DROP TRIGGER IF EXISTS trg_auto_migrate_on_service_insert ON services;
CREATE TRIGGER trg_auto_migrate_on_service_insert
  AFTER INSERT ON services
  FOR EACH ROW EXECUTE FUNCTION auto_migrate_profile_type();

DROP TRIGGER IF EXISTS trg_auto_migrate_on_service_delete ON services;
CREATE TRIGGER trg_auto_migrate_on_service_delete
  AFTER DELETE ON services
  FOR EACH ROW EXECUTE FUNCTION auto_migrate_profile_type();

-- 2. RLS: Clients cannot create jobs (only provider/rh/admin)
DROP POLICY IF EXISTS "Users can create own jobs" ON jobs;
CREATE POLICY "Users can create own jobs" ON jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (SELECT profile_type FROM profiles WHERE id = auth.uid()) != 'client'
      OR has_role(auth.uid(), 'admin')
    )
  );

-- 3. RLS: RH cannot create services
DROP POLICY IF EXISTS "Provider can manage own services" ON services;
CREATE POLICY "Provider can manage own services" ON services
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers WHERE providers.id = services.provider_id AND providers.user_id = auth.uid()
    )
    AND (
      (SELECT profile_type FROM profiles WHERE id = auth.uid()) != 'rh'
      OR has_role(auth.uid(), 'admin')
    )
  );

-- 4. Admin can update ANY profile
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 5. Admin can insert user_roles
DROP POLICY IF EXISTS "Admins can insert user roles" ON user_roles;
CREATE POLICY "Admins can insert user roles" ON user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 6. Admin can view all user_roles
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
CREATE POLICY "Admins can view all roles" ON user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

-- 7. Admin can delete user_roles
DROP POLICY IF EXISTS "Admins can delete user roles" ON user_roles;
CREATE POLICY "Admins can delete user roles" ON user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
