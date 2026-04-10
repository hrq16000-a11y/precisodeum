
CREATE OR REPLACE VIEW public.public_user_levels AS
SELECT id, name, color, description
FROM public.user_levels;

GRANT SELECT ON public.public_user_levels TO anon;
GRANT SELECT ON public.public_user_levels TO authenticated;
