/**
 * Listas de colunas "seguras" para SELECT no PostgREST.
 *
 * SEGURANÇA: colunas sensíveis foram revogadas no banco:
 *  - providers.cpf / cnpj / birth_date  → apenas dono e admin, via RPC get_provider_documents
 *  - jobs.contact_name / contact_phone / whatsapp → anônimo não lê; usar RPC get_job_contact
 *
 * Como as permissões agora são por coluna, `select('*')` nessas tabelas
 * resulta em "permission denied". Sempre use estas constantes.
 */

export const PROVIDER_SAFE_COLUMNS =
  'id, user_id, business_name, description, photo_url, city, state, neighborhood, phone, whatsapp, website, years_experience, category_id, plan, status, slug, featured, rating_avg, review_count, created_at, updated_at, latitude, longitude, response_time, service_radius, working_hours, deleted_at, user_ref, portfolio_photo_count, portfolio_album_count, services_count, onboarding_progress, category_custom, ibge_code, meta_title, meta_description, content_flags, avg_response_minutes, last_response_calc_at, community_verified, community_verified_at, account_type, legal_name, lead_followup_hours, notification_channels, mission_answers, is_verified, verified_at, verified_reason, verified_by, verified_manual, verified_criteria, geo_source, geo_source_confidence, geo_source_updated_at, geo_source_notes, neighborhood_source, neighborhood_source_at, last_active_at, completion_boost_until, street, street_number, complement, postal_code, business_segment, social_links, address_complete, show_full_address, working_hours_struct, opens_weekend, opens_late_night, opens_overnight, accepts_on_demand, contact_hours, meta_tracking, city_normalized' as const;

export const JOB_PUBLIC_COLUMNS =
  'id, user_id, title, category_id, opportunity_type, description, city, state, neighborhood, deadline, cover_image_url, status, slug, created_at, updated_at, subtitle, activities, requirements, schedule, salary, benefits, approval_status, job_type, work_model, deleted_at, view_count, user_ref, import_source_id, external_id' as const;
