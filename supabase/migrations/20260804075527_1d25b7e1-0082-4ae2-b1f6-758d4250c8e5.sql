-- Substitui a política pública ampla por uma restrita a entity_types públicos.
DROP POLICY IF EXISTS "Anyone can view active media" ON public.media;

CREATE POLICY "Public can view active public media"
ON public.media
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND entity_type IN ('service', 'portfolio', 'profile')
);

CREATE POLICY "Users can view own media"
ON public.media
FOR SELECT
TO authenticated
USING (
  user_ref = (SELECT p.user_ref FROM public.profiles p WHERE p.id = auth.uid())
);
