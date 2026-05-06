
-- Fix profiles RLS: restrict SELECT to own row + admins can see all
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
