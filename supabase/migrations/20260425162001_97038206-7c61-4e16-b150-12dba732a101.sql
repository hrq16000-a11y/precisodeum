-- Add lead_context jsonb column to store source/origin/city/uf/category
-- separately from the freeform message field.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_context jsonb NOT NULL DEFAULT '{}'::jsonb;

-- GIN index to enable filtering by context fields (origin, city, uf, category)
CREATE INDEX IF NOT EXISTS idx_leads_context_gin
  ON public.leads USING GIN (lead_context);

COMMENT ON COLUMN public.leads.lead_context IS
  'Structured context for the lead: origin/source page, city, uf, category, search query, referrer.';
