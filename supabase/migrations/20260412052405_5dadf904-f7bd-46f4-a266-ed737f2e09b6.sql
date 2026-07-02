
-- 1. Recreate public_jobs with auth-gated contact fields
DROP VIEW IF EXISTS public.public_jobs;
CREATE VIEW public.public_jobs
WITH (security_invoker = true) AS
SELECT 
  id, title, subtitle, description, city, state, neighborhood,
  job_type, work_model, opportunity_type, salary, schedule,
  requirements, benefits, activities, deadline, slug,
  category_id, status, view_count, created_at, updated_at,
  cover_image_url, approval_status, user_id, deleted_at,
  CASE WHEN auth.uid() IS NOT NULL THEN contact_name ELSE NULL END AS contact_name,
  CASE WHEN auth.uid() IS NOT NULL THEN contact_phone ELSE NULL END AS contact_phone,
  CASE WHEN auth.uid() IS NOT NULL THEN whatsapp ELSE NULL END AS whatsapp
FROM public.jobs
WHERE status = 'active' AND deleted_at IS NULL;

-- 2. Recreate views with security_invoker = true
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, full_name, avatar_url FROM public.profiles;

DROP VIEW IF EXISTS public.public_user_levels;
CREATE VIEW public.public_user_levels
WITH (security_invoker = true) AS
SELECT id, name, color, description FROM public.user_levels;

DROP VIEW IF EXISTS public.city_provider_stats;
CREATE VIEW public.city_provider_stats
WITH (security_invoker = true) AS
SELECT id AS city_id, name AS city_name, slug AS city_slug, state_uf,
  provider_count AS providers_count, has_providers AS has_active_providers
FROM public.cities;

-- 3. Fix sponsor_leads INSERT policy
DROP POLICY IF EXISTS "Anyone can submit sponsor lead" ON public.sponsor_leads;
CREATE POLICY "Anyone can submit sponsor lead"
  ON public.sponsor_leads FOR INSERT
  TO public
  WITH CHECK (
    COALESCE(TRIM(company_name), '') <> '' AND
    COALESCE(TRIM(email), '') <> '' AND
    COALESCE(TRIM(phone), '') <> ''
  );

-- 4. Fix pwa_install_events INSERT policy  
DROP POLICY IF EXISTS "Anyone can insert pwa events" ON public.pwa_install_events;
CREATE POLICY "Anyone can insert pwa events"
  ON public.pwa_install_events FOR INSERT
  TO public
  WITH CHECK (
    COALESCE(TRIM(event_type), '') <> ''
  );
