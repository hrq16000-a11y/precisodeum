-- Create a public view exposing only non-sensitive profile fields
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, full_name, avatar_url
FROM public.profiles;

-- Grant access to the view for anonymous users
GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;