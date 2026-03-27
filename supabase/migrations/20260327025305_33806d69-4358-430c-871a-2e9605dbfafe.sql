
CREATE TABLE public.hero_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  cta_text TEXT NOT NULL DEFAULT 'Cadastrar agora',
  cta_link TEXT NOT NULL DEFAULT '/cadastro',
  image_url TEXT,
  overlay_opacity NUMERIC NOT NULL DEFAULT 0.8,
  text_alignment TEXT NOT NULL DEFAULT 'center',
  animation_type TEXT NOT NULL DEFAULT 'fade',
  animation_duration NUMERIC NOT NULL DEFAULT 500,
  animation_delay NUMERIC NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  target_device TEXT NOT NULL DEFAULT 'all',
  target_city TEXT,
  target_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active hero banners"
  ON public.hero_banners FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY "Admins can manage hero banners"
  ON public.hero_banners FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
