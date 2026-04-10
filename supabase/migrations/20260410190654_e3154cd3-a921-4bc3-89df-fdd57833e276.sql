-- Add IBGE municipality code to providers
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS ibge_code text DEFAULT NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_providers_ibge_code ON public.providers (ibge_code) WHERE ibge_code IS NOT NULL;