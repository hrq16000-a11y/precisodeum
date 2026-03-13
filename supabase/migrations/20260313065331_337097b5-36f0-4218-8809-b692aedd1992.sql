
-- 1. Re-create the trigger for auto-creating profiles on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Add columns to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS whatsapp text NOT NULL DEFAULT '';
ALTER TABLE services ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id);

-- 3. Create service_images table
CREATE TABLE IF NOT EXISTS service_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service images viewable by everyone" ON service_images FOR SELECT USING (true);

CREATE POLICY "Provider can insert own service images" ON service_images FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM services s JOIN providers p ON p.id = s.provider_id
    WHERE s.id = service_images.service_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Provider can update own service images" ON service_images FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM services s JOIN providers p ON p.id = s.provider_id
    WHERE s.id = service_images.service_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Provider can delete own service images" ON service_images FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM services s JOIN providers p ON p.id = s.provider_id
    WHERE s.id = service_images.service_id AND p.user_id = auth.uid()
  ));

-- 4. Storage bucket for service images
INSERT INTO storage.buckets (id, name, public) VALUES ('service-images', 'service-images', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view service images" ON storage.objects FOR SELECT USING (bucket_id = 'service-images');
CREATE POLICY "Auth users can upload service images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'service-images');
CREATE POLICY "Users can update own service images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'service-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own service images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'service-images' AND (storage.foldername(name))[1] = auth.uid()::text);
