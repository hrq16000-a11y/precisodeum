-- S-A1 hardening: sponsors PII column protection (mirror agencies/providers pattern)
-- Removes permissive USING true policy and enforces column-level grants for anon.

BEGIN;

-- 1. Drop the permissive policy that neutralizes status='active' gating.
DROP POLICY IF EXISTS "Sponsors viewable by everyone" ON public.sponsors;

-- 2. Revoke table-level SELECT for anon (column grants take over).
REVOKE SELECT ON public.sponsors FROM anon;

-- 3. Grant SELECT only on safe / public columns for anon.
--    PII blocked for anon: cnpj, email, whatsapp, phone, user_ref,
--    rejection_reason, approved_by/at, rejected_by/at, last_viewed_status,
--    last_delivery_check_at, needs_compensation.
GRANT SELECT (
  id, user_id, slug,
  title, company_name, short_description, full_description,
  logo_url, image_url, link_url, external_link,
  linked_city, linked_city_slug, linked_category, linked_category_slug,
  status, plan, plan_tier, tier, sponsor_type, badge_type,
  position, ad_format, target_pages, display_order, active,
  start_date, end_date, campaign_start, campaign_end,
  guaranteed_impressions, delivered_impressions, impressions, clicks,
  pacing_status, max_width, max_height,
  deleted_at, created_at
) ON public.sponsors TO anon;

-- 4. Authenticated keeps full table SELECT (RLS still gates per-row: owner / admin / status=active).
--    Do not revoke from authenticated — owners and admins need every column.

COMMIT;