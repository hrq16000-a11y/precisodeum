-- 1. Add counter columns + onboarding to providers
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS portfolio_photo_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS portfolio_album_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS services_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS onboarding_progress jsonb DEFAULT '{"profile": false, "services": false, "portfolio": false, "completed": false}'::jsonb;

-- 2. Missing RLS: provider owner can delete own record
CREATE POLICY "Users can delete own provider"
ON public.providers FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. Trigger function: sync services_count
CREATE OR REPLACE FUNCTION public.sync_provider_services_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_provider_id := OLD.provider_id;
  ELSE
    v_provider_id := NEW.provider_id;
  END IF;

  UPDATE providers SET services_count = (
    SELECT COUNT(*) FROM services WHERE provider_id = v_provider_id AND deleted_at IS NULL
  ) WHERE id = v_provider_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_services_count
AFTER INSERT OR DELETE OR UPDATE OF deleted_at ON public.services
FOR EACH ROW EXECUTE FUNCTION public.sync_provider_services_count();

-- 4. Trigger function: sync portfolio_album_count
CREATE OR REPLACE FUNCTION public.sync_provider_album_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_provider_id := OLD.provider_id;
  ELSE
    v_provider_id := NEW.provider_id;
  END IF;

  UPDATE providers SET portfolio_album_count = (
    SELECT COUNT(*) FROM portfolio_albums WHERE provider_id = v_provider_id
  ) WHERE id = v_provider_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_album_count
AFTER INSERT OR DELETE ON public.portfolio_albums
FOR EACH ROW EXECUTE FUNCTION public.sync_provider_album_count();

-- 5. Trigger function: sync portfolio_photo_count
CREATE OR REPLACE FUNCTION public.sync_provider_photo_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_album_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_album_id := OLD.album_id;
  ELSE
    v_album_id := NEW.album_id;
  END IF;

  SELECT provider_id INTO v_provider_id FROM portfolio_albums WHERE id = v_album_id;
  IF v_provider_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE providers SET portfolio_photo_count = (
    SELECT COUNT(*) FROM portfolio_photos pp
    JOIN portfolio_albums pa ON pa.id = pp.album_id
    WHERE pa.provider_id = v_provider_id
  ) WHERE id = v_provider_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_photo_count
AFTER INSERT OR DELETE ON public.portfolio_photos
FOR EACH ROW EXECUTE FUNCTION public.sync_provider_photo_count();

-- 6. Backfill existing counters
UPDATE providers p SET
  services_count = COALESCE((SELECT COUNT(*) FROM services s WHERE s.provider_id = p.id AND s.deleted_at IS NULL), 0),
  portfolio_album_count = COALESCE((SELECT COUNT(*) FROM portfolio_albums pa WHERE pa.provider_id = p.id), 0),
  portfolio_photo_count = COALESCE((SELECT COUNT(*) FROM portfolio_photos pp JOIN portfolio_albums pa ON pa.id = pp.album_id WHERE pa.provider_id = p.id), 0);