REVOKE SELECT ON public.services FROM anon;

GRANT SELECT (
  id, provider_id, service_name, description, price, service_area, created_at,
  category_id, address, working_hours, website, deleted_at, user_ref, view_count,
  instagram_url, facebook_url, youtube_url, is_emergency, service_radius, seo_tags,
  meta_title, meta_description, updated_at, working_hours_struct, opens_weekend,
  opens_late_night, opens_overnight, is_24h, accepts_on_demand
) ON public.services TO anon;

GRANT SELECT ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;