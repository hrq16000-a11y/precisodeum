
-- Table for logging search demand coordinates (future heatmap)
CREATE TABLE public.search_demand_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude double precision,
  longitude double precision,
  geog extensions.geography(Point, 4326),
  query text DEFAULT '',
  category_slug text DEFAULT '',
  city text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Auto-populate geog from lat/lng
CREATE OR REPLACE FUNCTION public.sync_demand_log_geog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::extensions.geography;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_demand_log_geog
  BEFORE INSERT ON public.search_demand_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_demand_log_geog();

-- Spatial index for heatmap queries
CREATE INDEX idx_demand_logs_geog ON public.search_demand_logs USING gist(geog);
CREATE INDEX idx_demand_logs_created ON public.search_demand_logs(created_at DESC);

-- RLS
ALTER TABLE public.search_demand_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert demand logs"
  ON public.search_demand_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view demand logs"
  ON public.search_demand_logs
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
