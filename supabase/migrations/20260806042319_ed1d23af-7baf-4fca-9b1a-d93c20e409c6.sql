DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT p.id, p.full_name, p.avatar_url
FROM public.profiles p
WHERE
  auth.role() = 'authenticated'
  OR EXISTS (
    SELECT 1 FROM public.providers pr
    WHERE pr.user_id = p.id AND pr.status = 'approved'
  );

GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT ALL ON public.public_profiles TO service_role;