
-- ============================================================
-- FASE A: Adicionar user_ref em 6 tabelas faltantes
-- ============================================================

-- 1. portfolio_albums
ALTER TABLE public.portfolio_albums ADD COLUMN IF NOT EXISTS user_ref text;
CREATE INDEX IF NOT EXISTS idx_portfolio_albums_user_ref ON public.portfolio_albums(user_ref);

-- 2. portfolio_photos
ALTER TABLE public.portfolio_photos ADD COLUMN IF NOT EXISTS user_ref text;
CREATE INDEX IF NOT EXISTS idx_portfolio_photos_user_ref ON public.portfolio_photos(user_ref);

-- 3. user_tags
ALTER TABLE public.user_tags ADD COLUMN IF NOT EXISTS user_ref text;
CREATE INDEX IF NOT EXISTS idx_user_tags_user_ref ON public.user_tags(user_ref);

-- 4. notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_ref text;
CREATE INDEX IF NOT EXISTS idx_notifications_user_ref ON public.notifications(user_ref);

-- 5. jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS user_ref text;
CREATE INDEX IF NOT EXISTS idx_jobs_user_ref ON public.jobs(user_ref);

-- 6. reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS user_ref text;
CREATE INDEX IF NOT EXISTS idx_reviews_user_ref ON public.reviews(user_ref);

-- ============================================================
-- TRIGGERS: Auto-copiar user_ref do perfil em novos registros
-- ============================================================

-- Generic function: copia user_ref de profiles via user_id
CREATE OR REPLACE FUNCTION public.copy_user_ref_from_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_ref IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT pr.user_ref INTO NEW.user_ref
    FROM profiles pr
    WHERE pr.id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger to each table
CREATE OR REPLACE TRIGGER trg_portfolio_albums_user_ref
  BEFORE INSERT ON public.portfolio_albums
  FOR EACH ROW EXECUTE FUNCTION public.copy_user_ref_from_user_id();

CREATE OR REPLACE TRIGGER trg_portfolio_photos_user_ref
  BEFORE INSERT ON public.portfolio_photos
  FOR EACH ROW EXECUTE FUNCTION public.copy_user_ref_from_user_id();

CREATE OR REPLACE TRIGGER trg_user_tags_user_ref
  BEFORE INSERT ON public.user_tags
  FOR EACH ROW EXECUTE FUNCTION public.copy_user_ref_from_user_id();

CREATE OR REPLACE TRIGGER trg_notifications_user_ref
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.copy_user_ref_from_user_id();

CREATE OR REPLACE TRIGGER trg_jobs_user_ref
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.copy_user_ref_from_user_id();

CREATE OR REPLACE TRIGGER trg_reviews_user_ref
  BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.copy_user_ref_from_user_id();

-- ============================================================
-- BACKFILL: Popular user_ref em registros antigos
-- ============================================================

UPDATE public.portfolio_albums pa
SET user_ref = pr.user_ref
FROM profiles pr
WHERE pa.user_id = pr.id AND (pa.user_ref IS NULL OR pa.user_ref = '');

UPDATE public.portfolio_photos pp
SET user_ref = pr.user_ref
FROM profiles pr
WHERE pp.user_id = pr.id AND (pp.user_ref IS NULL OR pp.user_ref = '');

UPDATE public.user_tags ut
SET user_ref = pr.user_ref
FROM profiles pr
WHERE ut.user_id = pr.id AND (ut.user_ref IS NULL OR ut.user_ref = '');

UPDATE public.notifications n
SET user_ref = pr.user_ref
FROM profiles pr
WHERE n.user_id = pr.id AND (n.user_ref IS NULL OR n.user_ref = '');

UPDATE public.jobs j
SET user_ref = pr.user_ref
FROM profiles pr
WHERE j.user_id = pr.id AND (j.user_ref IS NULL OR j.user_ref = '');

UPDATE public.reviews r
SET user_ref = pr.user_ref
FROM profiles pr
WHERE r.user_id = pr.id AND (r.user_ref IS NULL OR r.user_ref = '');

-- ============================================================
-- VIEW: Recriar user_master_view com dados consolidados
-- ============================================================

DROP VIEW IF EXISTS public.user_master_view;

CREATE VIEW public.user_master_view AS
SELECT
  p.id,
  p.user_ref,
  p.full_name,
  p.email,
  p.phone,
  p.whatsapp,
  p.avatar_url,
  p.role,
  p.profile_type,
  p.status,
  p.engagement_points,
  p.level_id,
  p.account_type_id,
  p.created_at,
  p.updated_at,
  pr.id AS provider_id,
  pr.business_name,
  pr.city,
  pr.state,
  pr.plan AS provider_plan,
  pr.status AS provider_status,
  pr.slug AS provider_slug,
  pr.featured,
  pr.rating_avg,
  pr.review_count,
  pr.services_count,
  pr.portfolio_album_count,
  pr.portfolio_photo_count,
  ur.role AS system_role,
  COALESCE(pr.services_count, 0) AS total_services,
  (SELECT COUNT(*) FROM leads l WHERE l.provider_id = pr.id) AS total_leads,
  (SELECT COUNT(*) FROM reviews rv WHERE rv.user_id = p.id) AS total_reviews,
  (SELECT COUNT(*) FROM jobs j WHERE j.user_id = p.id AND j.deleted_at IS NULL) AS total_jobs,
  (SELECT COUNT(*) FROM notifications n WHERE n.user_id = p.id AND n.read = false) AS unread_notifications
FROM profiles p
LEFT JOIN providers pr ON pr.user_id = p.id AND pr.deleted_at IS NULL
LEFT JOIN user_roles ur ON ur.user_id = p.id;
