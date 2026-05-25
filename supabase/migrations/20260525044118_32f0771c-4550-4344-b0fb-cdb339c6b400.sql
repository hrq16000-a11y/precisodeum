
-- Drop + recreate view (CREATE OR REPLACE não permite remover coluna)
DROP VIEW IF EXISTS public.public_providers;

CREATE VIEW public.public_providers
WITH (security_invoker = true) AS
SELECT
  id, user_id, business_name, description, photo_url,
  city, state, neighborhood,
  phone, whatsapp, website,
  years_experience, category_id, plan, status, slug, featured,
  rating_avg, review_count, created_at, updated_at,
  latitude, longitude, response_time, service_radius, working_hours,
  deleted_at, user_ref,
  portfolio_photo_count, portfolio_album_count, services_count,
  onboarding_progress, category_custom, ibge_code, geog,
  meta_title, meta_description, content_flags,
  avg_response_minutes, last_response_calc_at,
  community_verified, community_verified_at,
  account_type, legal_name,
  lead_followup_hours, notification_channels,
  is_verified, verified_at, verified_reason, verified_by,
  verified_manual, verified_criteria,
  geo_source, geo_source_confidence, geo_source_updated_at, geo_source_notes,
  neighborhood_source, neighborhood_source_at,
  last_active_at, completion_boost_until,
  street, street_number, complement, postal_code,
  business_segment, social_links,
  address_complete, show_full_address,
  working_hours_struct, opens_weekend, opens_late_night, opens_overnight,
  is_24h, accepts_on_demand, contact_hours, meta_tracking
FROM public.providers
WHERE status = 'approved' AND deleted_at IS NULL;

COMMENT ON VIEW public.public_providers IS
'View pública de providers SEM PII (cpf/cnpj/birth_date) e SEM mission_answers. security_invoker=true respeita RLS + column-grants da tabela base.';

-- Revogar SELECT geral
REVOKE SELECT ON public.providers FROM anon;
REVOKE SELECT ON public.providers FROM authenticated;

-- Re-granular por coluna (77 colunas; exclui cpf, cnpj, birth_date, mission_answers)
GRANT SELECT (
  id, user_id, business_name, description, photo_url,
  city, state, neighborhood,
  phone, whatsapp, website,
  years_experience, category_id, plan, status, slug, featured,
  rating_avg, review_count, created_at, updated_at,
  latitude, longitude, response_time, service_radius, working_hours,
  deleted_at, user_ref,
  portfolio_photo_count, portfolio_album_count, services_count,
  onboarding_progress, category_custom, ibge_code, geog,
  meta_title, meta_description, content_flags,
  avg_response_minutes, last_response_calc_at,
  community_verified, community_verified_at,
  account_type, legal_name,
  lead_followup_hours, notification_channels,
  is_verified, verified_at, verified_reason, verified_by,
  verified_manual, verified_criteria,
  geo_source, geo_source_confidence, geo_source_updated_at, geo_source_notes,
  neighborhood_source, neighborhood_source_at,
  last_active_at, completion_boost_until,
  street, street_number, complement, postal_code,
  business_segment, social_links,
  address_complete, show_full_address,
  working_hours_struct, opens_weekend, opens_late_night, opens_overnight,
  is_24h, accepts_on_demand, contact_hours, meta_tracking
) ON public.providers TO anon, authenticated;

GRANT SELECT ON public.public_providers TO anon, authenticated;
