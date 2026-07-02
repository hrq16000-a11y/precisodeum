
-- 1. SEO metadata columns on providers
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text;

-- 2. Content error flags
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS content_flags jsonb DEFAULT '{}';

-- 3. Contact clicks log table
CREATE TABLE public.contact_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  contact_type text NOT NULL DEFAULT 'whatsapp',
  page_path text,
  visitor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a click (public tracking)
CREATE POLICY "Anyone can log contact clicks"
  ON public.contact_clicks FOR INSERT
  WITH CHECK (true);

-- Only admins can read clicks
CREATE POLICY "Admins can read contact clicks"
  ON public.contact_clicks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_contact_clicks_provider ON public.contact_clicks(provider_id);
CREATE INDEX idx_contact_clicks_date ON public.contact_clicks(created_at);
CREATE INDEX idx_contact_clicks_provider_date ON public.contact_clicks(provider_id, created_at DESC);
