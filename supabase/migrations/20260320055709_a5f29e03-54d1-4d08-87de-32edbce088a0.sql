
-- 2-level categories: add parent_id
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL DEFAULT NULL;

-- Blog/News table
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  cover_image_url text,
  author_name text NOT NULL DEFAULT 'Equipe Preciso de um',
  published boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog posts viewable by everyone" ON public.blog_posts
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can insert blog posts" ON public.blog_posts
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update blog posts" ON public.blog_posts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete blog posts" ON public.blog_posts
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Homepage sections config
INSERT INTO public.site_settings (key, label, value, description) VALUES
  ('homepage_sections_order', 'Ordem das seções da home', 'highlights,categories,ad1,featured,popular,recent,ad2,jobs,cities,cta,showcase,sponsors,howitworks,searches,testimonials,faq', 'Ordem das seções separadas por vírgula')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, label, value, description) VALUES
  ('homepage_hidden_sections', 'Seções ocultas da home', '', 'Seções ocultas separadas por vírgula')
ON CONFLICT (key) DO NOTHING;
