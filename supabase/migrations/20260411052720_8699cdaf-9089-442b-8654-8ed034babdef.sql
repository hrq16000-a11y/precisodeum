-- Recreate public_profiles view WITHOUT security_invoker = true
-- This allows public/anon access to limited profile data (name + avatar only)
-- without exposing PII in the base profiles table

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT id, full_name, avatar_url
FROM public.profiles;

-- Grant read access to the view for public visitors
GRANT SELECT ON public.public_profiles TO anon, authenticated;