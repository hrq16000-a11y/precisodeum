-- Sponsors: anon may read ONLY non-sensitive ad columns (no cnpj/email/phone/whatsapp/docs).
REVOKE SELECT ON public.sponsors FROM anon;

GRANT SELECT (
  id, user_id, slug, title, company_name, short_description, full_description,
  logo_url, image_url, link_url, external_link,
  linked_city, linked_city_slug, linked_category, linked_category_slug,
  status, plan, plan_tier, tier, sponsor_type, badge_type,
  position, ad_format, target_pages, display_order, active,
  start_date, end_date, campaign_start, campaign_end,
  guaranteed_impressions, delivered_impressions, impressions, clicks,
  pacing_status, max_width, max_height, deleted_at, created_at
) ON public.sponsors TO anon;

-- Profiles: defensive, idempotent revoke of sensitive columns for public roles.
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT (tax_id, tax_id_encrypted) ON public.profiles FROM anon, authenticated;
REVOKE SELECT (registration_ip, registration_user_agent) ON public.profiles FROM anon;