CREATE INDEX IF NOT EXISTS idx_leads_provider_created ON public.leads (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_clicks_provider_created ON public.contact_clicks (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_impressions_provider_date ON public.provider_impressions (provider_id, date DESC);