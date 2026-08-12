-- 1) providers: remove full-row SELECT from authenticated, re-grant safe columns only
REVOKE SELECT ON public.providers FROM authenticated;
GRANT SELECT (id, user_id, business_name, description, photo_url, city, state, neighborhood, phone, whatsapp, website, years_experience, category_id, plan, status, slug, featured, rating_avg, review_count, created_at, updated_at, latitude, longitude, response_time, service_radius, working_hours, deleted_at, user_ref, portfolio_photo_count, portfolio_album_count, services_count, onboarding_progress, category_custom, ibge_code, geog, meta_title, meta_description, content_flags, avg_response_minutes, last_response_calc_at, community_verified, community_verified_at, account_type, legal_name, lead_followup_hours, notification_channels, mission_answers, is_verified, verified_at, verified_reason, verified_by, verified_manual, verified_criteria, geo_source, geo_source_confidence, geo_source_updated_at, geo_source_notes, neighborhood_source, neighborhood_source_at, last_active_at, completion_boost_until, street, street_number, complement, postal_code, business_segment, social_links, address_complete, show_full_address, working_hours_struct, opens_weekend, opens_late_night, opens_overnight, is_24h, accepts_on_demand, contact_hours, meta_tracking, city_normalized)
ON public.providers TO authenticated;

CREATE OR REPLACE FUNCTION public.get_provider_documents(_provider_ids uuid[] DEFAULT NULL)
RETURNS TABLE (id uuid, user_id uuid, cpf text, cnpj text, birth_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.cpf, p.cnpj, p.birth_date
  FROM public.providers p
  WHERE auth.uid() IS NOT NULL
    AND (_provider_ids IS NULL OR p.id = ANY(_provider_ids))
    AND (p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
$$;

REVOKE ALL ON FUNCTION public.get_provider_documents(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_documents(uuid[]) TO authenticated;

-- 2) jobs: hide contact columns from anonymous visitors
REVOKE SELECT ON public.jobs FROM anon;
GRANT SELECT (id, user_id, title, category_id, opportunity_type, description, city, state, neighborhood, deadline, cover_image_url, status, slug, created_at, updated_at, subtitle, activities, requirements, schedule, salary, benefits, approval_status, job_type, work_model, deleted_at, view_count, user_ref, import_source_id, external_id)
ON public.jobs TO anon;

CREATE OR REPLACE FUNCTION public.get_job_contact(_job_id uuid)
RETURNS TABLE (contact_name text, contact_phone text, whatsapp text, masked boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j RECORD;
  is_auth boolean := auth.uid() IS NOT NULL;
BEGIN
  SELECT jb.contact_name, jb.contact_phone, jb.whatsapp
    INTO j
  FROM public.jobs jb
  WHERE jb.id = _job_id
    AND jb.deleted_at IS NULL
    AND (jb.status = 'active' OR jb.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF is_auth THEN
    RETURN QUERY SELECT j.contact_name, j.contact_phone, j.whatsapp, false;
  ELSE
    RETURN QUERY SELECT
      j.contact_name,
      CASE WHEN j.contact_phone IS NULL OR length(regexp_replace(j.contact_phone, '\D', '', 'g')) < 4
           THEN NULL
           ELSE repeat('*', greatest(length(regexp_replace(j.contact_phone, '\D', '', 'g')) - 4, 0))
                || right(regexp_replace(j.contact_phone, '\D', '', 'g'), 4) END,
      CASE WHEN j.whatsapp IS NULL OR length(regexp_replace(j.whatsapp, '\D', '', 'g')) < 4
           THEN NULL
           ELSE repeat('*', greatest(length(regexp_replace(j.whatsapp, '\D', '', 'g')) - 4, 0))
                || right(regexp_replace(j.whatsapp, '\D', '', 'g'), 4) END,
      true;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_job_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_job_contact(uuid) TO anon, authenticated;