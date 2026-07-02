
-- Add professional service columns
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS is_emergency boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS service_radius text NOT NULL DEFAULT 'city',
ADD COLUMN IF NOT EXISTS seo_tags text[] NOT NULL DEFAULT '{}';

-- Index for emergency filter searches
CREATE INDEX IF NOT EXISTS idx_services_is_emergency ON public.services (is_emergency) WHERE is_emergency = true;

-- GIN index for seo_tags search
CREATE INDEX IF NOT EXISTS idx_services_seo_tags ON public.services USING GIN (seo_tags);
