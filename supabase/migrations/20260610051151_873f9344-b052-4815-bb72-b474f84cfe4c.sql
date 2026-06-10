-- =========================================================
-- A) public.agencies — hide email/cnpj/legal_name from anon
-- =========================================================
REVOKE SELECT ON public.agencies FROM anon;
GRANT SELECT (
  id, user_id, name, slug, status, city, state, description,
  logo_url, cover_image_url, website, whatsapp, user_ref,
  created_at, updated_at
) ON public.agencies TO anon;

-- =========================================================
-- B) public.providers — hide PII + moderation columns from anon
-- =========================================================
REVOKE SELECT ON public.providers FROM anon;
GRANT SELECT (
  id, user_id, business_name, description, photo_url, city, state, neighborhood,
  phone, whatsapp, website, years_experience, category_id, plan, status, slug,
  featured, rating_avg, review_count, created_at, updated_at, latitude, longitude,
  response_time, service_radius, working_hours, deleted_at, user_ref,
  portfolio_photo_count, portfolio_album_count, services_count, onboarding_progress,
  category_custom, geog, meta_title, meta_description, avg_response_minutes,
  last_response_calc_at, community_verified, community_verified_at, account_type,
  is_verified, verified_at, verified_reason, verified_manual, geo_source,
  geo_source_confidence, geo_source_updated_at, neighborhood_source,
  neighborhood_source_at, last_active_at, completion_boost_until, street,
  street_number, complement, postal_code, business_segment, social_links,
  address_complete, show_full_address, working_hours_struct, opens_weekend,
  opens_late_night, opens_overnight, is_24h, accepts_on_demand, contact_hours,
  city_normalized
) ON public.providers TO anon;

-- =========================================================
-- C) public.sponsor_leads — scope anon UPDATE to doc URLs only
-- =========================================================
REVOKE UPDATE ON public.sponsor_leads FROM anon;
GRANT UPDATE (cnpj_document_url, banner_url) ON public.sponsor_leads TO anon;

-- =========================================================
-- D) public.system_audit_logs — restrict direct INSERT to admins
--    (SECURITY DEFINER triggers/functions continue to work)
-- =========================================================
DROP POLICY IF EXISTS "Authenticated insert system_audit_logs" ON public.system_audit_logs;
CREATE POLICY "Admins insert system_audit_logs"
ON public.system_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND staff_id = auth.uid());
