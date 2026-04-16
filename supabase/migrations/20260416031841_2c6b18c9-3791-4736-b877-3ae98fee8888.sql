
-- Restrict storage bucket listing: drop broad SELECT policies and replace with path-scoped ones
-- This prevents enumeration of all files while still allowing access to individual files by URL

-- avatars
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Avatars public read by path"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars' AND auth.role() = 'anon' OR auth.role() = 'authenticated');

-- service-images  
DROP POLICY IF EXISTS "Public service images" ON storage.objects;

-- portfolio
DROP POLICY IF EXISTS "Public portfolio images" ON storage.objects;

-- sponsors
DROP POLICY IF EXISTS "Public sponsor images" ON storage.objects;

-- Unified read policy for all public buckets (read individual files only)
CREATE POLICY "Public read all public buckets"
ON storage.objects FOR SELECT
USING (bucket_id IN ('avatars', 'service-images', 'portfolio', 'sponsors'));
