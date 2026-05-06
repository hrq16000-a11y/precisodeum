
CREATE TABLE public.provider_page_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL UNIQUE REFERENCES public.providers(id) ON DELETE CASCADE,
  sections_order jsonb NOT NULL DEFAULT '["about","portfolio","services","reviews","lead_form"]'::jsonb,
  hidden_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  headline text DEFAULT '',
  tagline text DEFAULT '',
  cta_text text DEFAULT 'Solicitar Orçamento',
  cta_whatsapp_text text DEFAULT 'Chamar no WhatsApp',
  accent_color text DEFAULT '',
  cover_image_url text DEFAULT '',
  instagram_url text DEFAULT '',
  facebook_url text DEFAULT '',
  youtube_url text DEFAULT '',
  tiktok_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_page_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can view page settings (public landing page)
CREATE POLICY "Page settings viewable by everyone"
ON public.provider_page_settings FOR SELECT
TO public
USING (true);

-- Provider can insert own page settings
CREATE POLICY "Provider can insert own page settings"
ON public.provider_page_settings FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.providers
    WHERE providers.id = provider_page_settings.provider_id
    AND providers.user_id = auth.uid()
  )
);

-- Provider can update own page settings
CREATE POLICY "Provider can update own page settings"
ON public.provider_page_settings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.providers
    WHERE providers.id = provider_page_settings.provider_id
    AND providers.user_id = auth.uid()
  )
);

-- Provider can delete own page settings
CREATE POLICY "Provider can delete own page settings"
ON public.provider_page_settings FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.providers
    WHERE providers.id = provider_page_settings.provider_id
    AND providers.user_id = auth.uid()
  )
);
