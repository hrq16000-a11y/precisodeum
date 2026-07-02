
-- Fase 1: View pública sem PII (cpf/cnpj/birth_date)
-- security_invoker=true → respeita RLS da tabela base (policy de approved já filtra linhas)

CREATE OR REPLACE VIEW public.public_providers
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
  onboarding_progress,
  category_custom, ibge_code, geog,
  meta_title, meta_description, content_flags,
  avg_response_minutes, last_response_calc_at,
  community_verified, community_verified_at,
  account_type, legal_name,
  lead_followup_hours, notification_channels, mission_answers,
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

-- Fase 2: Revogar acesso direto às colunas PII na tabela base
REVOKE SELECT (cpf, cnpj, birth_date) ON public.providers FROM anon;
REVOKE SELECT (cpf, cnpj, birth_date) ON public.providers FROM authenticated;

-- Fase 3: Garantir SELECT na view para públicos
GRANT SELECT ON public.public_providers TO anon;
GRANT SELECT ON public.public_providers TO authenticated;

COMMENT ON VIEW public.public_providers IS
'View pública de providers SEM PII (cpf/cnpj/birth_date). security_invoker=true respeita RLS da tabela base. Use para qualquer consumo público (listagens, perfil, busca). Acesso direto a providers.cpf/cnpj/birth_date é restrito a service_role e ao próprio dono via RPC.';
