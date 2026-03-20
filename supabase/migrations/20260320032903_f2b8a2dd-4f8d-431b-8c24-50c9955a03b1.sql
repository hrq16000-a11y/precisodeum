
CREATE TABLE public.community_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text NOT NULL,
  icon text NOT NULL DEFAULT '🔗',
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Community links viewable by authenticated" ON public.community_links
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert community links" ON public.community_links
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update community links" ON public.community_links
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete community links" ON public.community_links
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS start_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS impressions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks integer NOT NULL DEFAULT 0;
