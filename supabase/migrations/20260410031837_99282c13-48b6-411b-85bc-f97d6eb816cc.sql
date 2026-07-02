
-- Helper function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Portfolio Albums
CREATE TABLE public.portfolio_albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolio albums viewable by everyone"
  ON public.portfolio_albums FOR SELECT USING (true);

CREATE POLICY "Users can insert own portfolio albums"
  ON public.portfolio_albums FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolio albums"
  ON public.portfolio_albums FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolio albums"
  ON public.portfolio_albums FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all portfolio albums"
  ON public.portfolio_albums FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_portfolio_albums_provider ON public.portfolio_albums(provider_id);

CREATE TRIGGER update_portfolio_albums_updated_at
  BEFORE UPDATE ON public.portfolio_albums
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Portfolio Photos
CREATE TABLE public.portfolio_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID NOT NULL REFERENCES public.portfolio_albums(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL DEFAULT '',
  original_name TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolio photos viewable by everyone"
  ON public.portfolio_photos FOR SELECT USING (true);

CREATE POLICY "Users can insert own portfolio photos"
  ON public.portfolio_photos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolio photos"
  ON public.portfolio_photos FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolio photos"
  ON public.portfolio_photos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all portfolio photos"
  ON public.portfolio_photos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_portfolio_photos_album ON public.portfolio_photos(album_id);
