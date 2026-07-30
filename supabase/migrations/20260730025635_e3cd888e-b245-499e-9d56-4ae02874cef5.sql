-- Harden public sponsor reads: anon can only read explicitly safe public columns.
-- Sensitive sponsor contact/tax columns remain unavailable to anonymous visitors.

REVOKE ALL ON TABLE public.sponsors FROM PUBLIC;
REVOKE ALL ON TABLE public.sponsors FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sponsors TO authenticated;
GRANT ALL ON TABLE public.sponsors TO service_role;

GRANT SELECT (
  id,
  user_id,
  slug,
  title,
  company_name,
  short_description,
  full_description,
  logo_url,
  image_url,
  link_url,
  external_link,
  linked_city,
  linked_city_slug,
  linked_category,
  linked_category_slug,
  status,
  active,
  plan,
  plan_tier,
  tier,
  sponsor_type,
  badge_type,
  position,
  ad_format,
  target_pages,
  display_order,
  start_date,
  end_date,
  campaign_start,
  campaign_end,
  guaranteed_impressions,
  delivered_impressions,
  impressions,
  clicks,
  pacing_status,
  max_width,
  max_height,
  deleted_at,
  created_at
) ON TABLE public.sponsors TO anon;

DROP POLICY IF EXISTS "Public sees only active sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Anon can view active sponsors public columns" ON public.sponsors;
DROP POLICY IF EXISTS "Admins can view all sponsors" ON public.sponsors;

CREATE POLICY "Anon can view active sponsors public columns"
ON public.sponsors
FOR SELECT
TO anon
USING (
  status = 'active'
  AND COALESCE(active, true) = true
  AND deleted_at IS NULL
);

CREATE POLICY "Admins can view all sponsors"
ON public.sponsors
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Optional safe public view for future callsites; direct table access remains column-limited.
CREATE OR REPLACE VIEW public.sponsors_public
WITH (security_invoker = on) AS
SELECT
  id,
  user_id,
  slug,
  title,
  company_name,
  short_description,
  full_description,
  logo_url,
  image_url,
  link_url,
  external_link,
  linked_city,
  linked_city_slug,
  linked_category,
  linked_category_slug,
  status,
  active,
  plan,
  plan_tier,
  tier,
  sponsor_type,
  badge_type,
  position,
  ad_format,
  target_pages,
  display_order,
  start_date,
  end_date,
  campaign_start,
  campaign_end,
  guaranteed_impressions,
  delivered_impressions,
  impressions,
  clicks,
  pacing_status,
  max_width,
  max_height,
  deleted_at,
  created_at
FROM public.sponsors
WHERE status = 'active'
  AND COALESCE(active, true) = true
  AND deleted_at IS NULL;

GRANT SELECT ON public.sponsors_public TO anon;
GRANT SELECT ON public.sponsors_public TO authenticated;
GRANT ALL ON public.sponsors_public TO service_role;