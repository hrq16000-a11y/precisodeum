
-- Table: How It Works steps
CREATE TABLE public.home_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step integer NOT NULL DEFAULT 1,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🔍',
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.home_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Home steps viewable by everyone" ON public.home_steps FOR SELECT TO public USING (active = true);
CREATE POLICY "Admins can manage home steps" ON public.home_steps FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Table: Testimonials
CREATE TABLE public.home_testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  text text NOT NULL DEFAULT '',
  rating integer NOT NULL DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.home_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Testimonials viewable by everyone" ON public.home_testimonials FOR SELECT TO public USING (active = true);
CREATE POLICY "Admins can manage testimonials" ON public.home_testimonials FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Table: CTA blocks
CREATE TABLE public.home_cta_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  button_text text NOT NULL DEFAULT '',
  button_link text NOT NULL DEFAULT '/',
  icon text NOT NULL DEFAULT 'Sparkles',
  variant text NOT NULL DEFAULT 'primary',
  section text NOT NULL DEFAULT 'mid',
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.home_cta_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CTA blocks viewable by everyone" ON public.home_cta_blocks FOR SELECT TO public USING (active = true);
CREATE POLICY "Admins can manage CTA blocks" ON public.home_cta_blocks FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
