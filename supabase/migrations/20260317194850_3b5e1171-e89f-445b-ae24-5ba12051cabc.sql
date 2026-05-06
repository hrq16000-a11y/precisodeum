-- Remove the anon policy that re-exposes all columns
DROP POLICY IF EXISTS "Public can read profiles for views" ON public.profiles;

-- Recreate view as security definer (intentional - only exposes safe columns, read-only)
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles WITH (security_invoker = false) AS
SELECT id, full_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;