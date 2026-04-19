CREATE INDEX IF NOT EXISTS idx_providers_geog_active
  ON public.providers
  USING GIST (geog)
  WHERE status = 'approved' AND deleted_at IS NULL;