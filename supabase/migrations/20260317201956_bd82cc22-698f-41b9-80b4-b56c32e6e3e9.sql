
-- Drop any pre-existing storage policies that conflict
DROP POLICY IF EXISTS "Users can update own portfolio" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own portfolio" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own service images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own service images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own service images" ON storage.objects;

-- Recreate portfolio policies
CREATE POLICY "Users can update own portfolio"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own portfolio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Recreate service-images policies
CREATE POLICY "Users can upload own service images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own service images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'service-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own service images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'service-images' AND (storage.foldername(name))[1] = auth.uid()::text);
