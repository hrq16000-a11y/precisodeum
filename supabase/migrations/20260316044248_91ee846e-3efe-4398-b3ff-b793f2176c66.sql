CREATE TABLE public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text,
  link_url text,
  position text NOT NULL DEFAULT 'banner',
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sponsors viewable by everyone" ON public.sponsors
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can insert sponsors" ON public.sponsors
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sponsors" ON public.sponsors
  FOR UPDATE TO authenticated 
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sponsors" ON public.sponsors
  FOR DELETE TO authenticated 
  USING (has_role(auth.uid(), 'admin'::app_role));