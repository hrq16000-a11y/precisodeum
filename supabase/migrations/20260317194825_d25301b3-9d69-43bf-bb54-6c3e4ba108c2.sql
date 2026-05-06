-- Recreate the view with SECURITY INVOKER (default in PG15+, but explicit for clarity)
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles WITH (security_invoker = true) AS
SELECT id, full_name, avatar_url
FROM public.profiles;

-- Need a public SELECT policy on profiles for just these columns via the view
-- Since views with security_invoker use the caller's permissions, 
-- we need a limited public policy. But we can't do column-level RLS in Postgres.
-- Instead, add back a public SELECT policy on profiles (the view only exposes safe columns)
CREATE POLICY "Public can read profiles for views"
ON public.profiles
FOR SELECT
TO anon
USING (true);

GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;