
-- Popular services table
CREATE TABLE public.popular_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category_name text NOT NULL DEFAULT '',
  category_slug text DEFAULT NULL,
  min_price numeric NOT NULL DEFAULT 0,
  icon text NOT NULL DEFAULT '🔧',
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.popular_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Popular services viewable by everyone" ON public.popular_services FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert popular services" ON public.popular_services FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update popular services" ON public.popular_services FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete popular services" ON public.popular_services FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- FAQ table
CREATE TABLE public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FAQs viewable by everyone" ON public.faqs FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert faqs" ON public.faqs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update faqs" ON public.faqs FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete faqs" ON public.faqs FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
