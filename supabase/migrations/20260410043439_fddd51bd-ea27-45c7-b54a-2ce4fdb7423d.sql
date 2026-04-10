
-- Add computed fields to cities
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS provider_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS has_providers boolean NOT NULL DEFAULT false;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cities_state_uf ON public.cities (state_uf);
CREATE INDEX IF NOT EXISTS idx_cities_has_providers ON public.cities (has_providers) WHERE has_providers = true;
CREATE INDEX IF NOT EXISTS idx_cities_slug ON public.cities (slug);

-- Drop and recreate view with matching column names
DROP VIEW IF EXISTS public.city_provider_stats;
CREATE VIEW public.city_provider_stats AS
SELECT
  c.id AS city_id,
  c.name AS city_name,
  c.slug AS city_slug,
  c.state_uf,
  c.provider_count AS providers_count,
  c.has_providers AS has_active_providers
FROM public.cities c;

-- Function to sync provider_count on cities
CREATE OR REPLACE FUNCTION public.sync_city_provider_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city_old text;
  v_state_old text;
  v_city_new text;
  v_state_new text;
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    v_city_old := OLD.city;
    v_state_old := OLD.state;
  END IF;
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_city_new := NEW.city;
    v_state_new := NEW.state;
  END IF;

  IF v_city_old IS NOT NULL AND (TG_OP = 'DELETE' OR v_city_old IS DISTINCT FROM v_city_new OR v_state_old IS DISTINCT FROM v_state_new) THEN
    UPDATE cities SET
      provider_count = (
        SELECT COUNT(*) FROM providers
        WHERE LOWER(TRIM(city)) = LOWER(TRIM(v_city_old))
        AND state = v_state_old
        AND status = 'approved' AND deleted_at IS NULL
      ),
      has_providers = (
        SELECT COUNT(*) > 0 FROM providers
        WHERE LOWER(TRIM(city)) = LOWER(TRIM(v_city_old))
        AND state = v_state_old
        AND status = 'approved' AND deleted_at IS NULL
      )
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_city_old)) AND state_uf = v_state_old;
  END IF;

  IF v_city_new IS NOT NULL AND (TG_OP = 'INSERT' OR v_city_old IS DISTINCT FROM v_city_new OR v_state_old IS DISTINCT FROM v_state_new) THEN
    UPDATE cities SET
      provider_count = (
        SELECT COUNT(*) FROM providers
        WHERE LOWER(TRIM(city)) = LOWER(TRIM(v_city_new))
        AND state = v_state_new
        AND status = 'approved' AND deleted_at IS NULL
      ),
      has_providers = (
        SELECT COUNT(*) > 0 FROM providers
        WHERE LOWER(TRIM(city)) = LOWER(TRIM(v_city_new))
        AND state = v_state_new
        AND status = 'approved' AND deleted_at IS NULL
      )
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_city_new)) AND state_uf = v_state_new;
  END IF;

  IF TG_OP = 'UPDATE' AND v_city_old IS NOT DISTINCT FROM v_city_new AND v_state_old IS NOT DISTINCT FROM v_state_new THEN
    IF OLD.status IS DISTINCT FROM NEW.status OR (OLD.deleted_at IS NULL) <> (NEW.deleted_at IS NULL) THEN
      UPDATE cities SET
        provider_count = (
          SELECT COUNT(*) FROM providers
          WHERE LOWER(TRIM(city)) = LOWER(TRIM(v_city_new))
          AND state = v_state_new
          AND status = 'approved' AND deleted_at IS NULL
        ),
        has_providers = (
          SELECT COUNT(*) > 0 FROM providers
          WHERE LOWER(TRIM(city)) = LOWER(TRIM(v_city_new))
          AND state = v_state_new
          AND status = 'approved' AND deleted_at IS NULL
        )
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_city_new)) AND state_uf = v_state_new;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger on providers table
DROP TRIGGER IF EXISTS trg_sync_city_provider_count ON public.providers;
CREATE TRIGGER trg_sync_city_provider_count
AFTER INSERT OR UPDATE OR DELETE ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.sync_city_provider_count();

-- Initial sync
UPDATE public.cities c SET
  provider_count = COALESCE((
    SELECT COUNT(*) FROM public.providers p
    WHERE LOWER(TRIM(p.city)) = LOWER(TRIM(c.name))
    AND p.state = c.state_uf
    AND p.status = 'approved' AND p.deleted_at IS NULL
  ), 0);

UPDATE public.cities SET has_providers = (provider_count > 0);
