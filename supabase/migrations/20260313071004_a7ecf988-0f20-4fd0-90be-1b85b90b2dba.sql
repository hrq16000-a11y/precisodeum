
-- Junction table for multiple categories per service
CREATE TABLE IF NOT EXISTS service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(service_id, category_id)
);

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service categories viewable by everyone" ON service_categories FOR SELECT USING (true);

CREATE POLICY "Provider can insert own service categories" ON service_categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM services s JOIN providers p ON p.id = s.provider_id
    WHERE s.id = service_categories.service_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Provider can delete own service categories" ON service_categories FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM services s JOIN providers p ON p.id = s.provider_id
    WHERE s.id = service_categories.service_id AND p.user_id = auth.uid()
  ));

-- Add address and working_hours to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
ALTER TABLE services ADD COLUMN IF NOT EXISTS working_hours text NOT NULL DEFAULT '';
