
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- Add geography column to providers
ALTER TABLE public.providers 
  ADD COLUMN IF NOT EXISTS geog extensions.geography(Point, 4326);

-- Backfill geog from existing latitude/longitude
UPDATE public.providers 
SET geog = ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::extensions.geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Spatial GiST index
CREATE INDEX IF NOT EXISTS idx_providers_geog ON public.providers USING GIST (geog);

-- Trigger function to keep geog in sync
CREATE OR REPLACE FUNCTION public.sync_provider_geog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326)::extensions.geography;
  ELSE
    NEW.geog := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on insert/update of coordinates
CREATE TRIGGER trg_sync_provider_geog
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.sync_provider_geog();
