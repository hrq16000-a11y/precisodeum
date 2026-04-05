
-- ===========================================
-- Table: page_blocks
-- ===========================================
CREATE TABLE public.page_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_slug text NOT NULL DEFAULT 'home',
  block_type text NOT NULL DEFAULT 'text',
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  start_date timestamptz,
  end_date timestamptz,
  target_city text,
  target_category text,
  target_campaign text,
  sponsor_id uuid REFERENCES public.sponsors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.page_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Page blocks viewable by everyone"
  ON public.page_blocks FOR SELECT
  TO public
  USING (active = true);

CREATE POLICY "Admins can view all page blocks"
  ON public.page_blocks FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert page blocks"
  ON public.page_blocks FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update page blocks"
  ON public.page_blocks FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete page blocks"
  ON public.page_blocks FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_page_blocks_page_slug ON public.page_blocks(page_slug);
CREATE INDEX idx_page_blocks_order ON public.page_blocks(display_order);

-- ===========================================
-- Table: institutional_pages
-- ===========================================
CREATE TABLE public.institutional_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  meta_title text NOT NULL DEFAULT '',
  meta_description text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.institutional_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published pages viewable by everyone"
  ON public.institutional_pages FOR SELECT
  TO public
  USING (published = true);

CREATE POLICY "Admins can view all pages"
  ON public.institutional_pages FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert pages"
  ON public.institutional_pages FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pages"
  ON public.institutional_pages FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pages"
  ON public.institutional_pages FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_institutional_pages_slug ON public.institutional_pages(slug);
