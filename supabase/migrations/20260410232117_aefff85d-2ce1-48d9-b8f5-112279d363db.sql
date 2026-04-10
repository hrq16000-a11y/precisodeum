
-- 1. Ensure has_role function exists and is safe
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 2. Sponsors storage: INSERT admin only
DROP POLICY IF EXISTS "Admin insert sponsors" ON storage.objects;
CREATE POLICY "Admin insert sponsors"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'sponsors'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- 3. Sponsors storage: UPDATE admin only
DROP POLICY IF EXISTS "Admin update sponsors" ON storage.objects;
CREATE POLICY "Admin update sponsors"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'sponsors'
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'sponsors'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Sponsors storage: DELETE admin only
DROP POLICY IF EXISTS "Admin delete sponsors" ON storage.objects;
CREATE POLICY "Admin delete sponsors"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'sponsors'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- 5. Block non-admin SELECT on sponsors bucket
DROP POLICY IF EXISTS "Block non-admin sponsor access" ON storage.objects;
CREATE POLICY "Block non-admin sponsor access"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id <> 'sponsors'
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 6. audit_log: allow any authenticated user to insert own log
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated users can insert own audit log"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 7. Remove duplicate storage policies
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload portfolio" ON storage.objects;
