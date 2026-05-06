-- Create media table for unified media management
CREATE TABLE public.media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_ref TEXT,
  entity_type TEXT NOT NULL DEFAULT 'generic',
  entity_ref TEXT,
  original_name TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL DEFAULT '',
  public_url TEXT NOT NULL DEFAULT '',
  hash TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  size_original BIGINT DEFAULT 0,
  size_optimized BIGINT DEFAULT 0,
  width INTEGER DEFAULT 0,
  height INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_media_user_ref ON public.media (user_ref);
CREATE INDEX idx_media_entity ON public.media (entity_type, entity_ref);
CREATE INDEX idx_media_hash ON public.media (hash);

-- Enable RLS
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Anyone can view active media
CREATE POLICY "Anyone can view active media"
  ON public.media FOR SELECT
  TO public
  USING (is_active = true);

-- Admins can view all media (including inactive)
CREATE POLICY "Admins can view all media"
  ON public.media FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can insert media linked to their user_ref
CREATE POLICY "Users can insert own media"
  ON public.media FOR INSERT
  TO authenticated
  WITH CHECK (
    user_ref = (SELECT p.user_ref FROM public.profiles p WHERE p.id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Users can update their own media
CREATE POLICY "Users can update own media"
  ON public.media FOR UPDATE
  TO authenticated
  USING (
    user_ref = (SELECT p.user_ref FROM public.profiles p WHERE p.id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Users can delete their own media
CREATE POLICY "Users can delete own media"
  ON public.media FOR DELETE
  TO authenticated
  USING (
    user_ref = (SELECT p.user_ref FROM public.profiles p WHERE p.id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );