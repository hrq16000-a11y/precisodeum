
-- Admin can delete any file in avatars
CREATE POLICY "Admin can delete any avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete any file in portfolio
CREATE POLICY "Admin can delete any portfolio"
ON storage.objects FOR DELETE
USING (bucket_id = 'portfolio' AND has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete any file in service-images
CREATE POLICY "Admin can delete any service-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'service-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Admin can update any file in avatars
CREATE POLICY "Admin can update any avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND has_role(auth.uid(), 'admin'::app_role));

-- Admin can update any file in portfolio
CREATE POLICY "Admin can update any portfolio"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portfolio' AND has_role(auth.uid(), 'admin'::app_role));

-- Admin can update any file in service-images
CREATE POLICY "Admin can update any service-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'service-images' AND has_role(auth.uid(), 'admin'::app_role));
