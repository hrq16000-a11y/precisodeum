-- Hardening anon column access on public.providers
-- Anon must NOT read PII (cpf, cnpj, birth_date, full address, legal_name, account_type, verified_by/criteria, notification_channels, social_links, mission_answers, meta_tracking, content_flags, address_complete, geo_source_notes).
REVOKE SELECT ON public.providers FROM anon;

GRANT SELECT (
  id, user_id, business_name, description, photo_url,
  city, state, neighborhood, phone, whatsapp, website,
  years_experience, category_id, plan, status, slug, featured,
  rating_avg, review_count, created_at, updated_at,
  latitude, longitude, response_time, service_radius, working_hours,
  deleted_at, user_ref, portfolio_photo_count, portfolio_album_count,
  services_count, onboarding_progress, category_custom, ibge_code, geog,
  meta_title, meta_description, avg_response_minutes, last_response_calc_at,
  community_verified, community_verified_at, lead_followup_hours,
  is_verified, verified_at, verified_reason, verified_manual,
  geo_source, geo_source_confidence, geo_source_updated_at,
  neighborhood_source, neighborhood_source_at,
  last_active_at, completion_boost_until, business_segment,
  show_full_address, working_hours_struct,
  opens_weekend, opens_late_night, opens_overnight, is_24h,
  accepts_on_demand, contact_hours
) ON public.providers TO anon;

-- authenticated/service_role keep full access (RLS still enforces row visibility)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.providers TO authenticated;
GRANT ALL ON public.providers TO service_role;