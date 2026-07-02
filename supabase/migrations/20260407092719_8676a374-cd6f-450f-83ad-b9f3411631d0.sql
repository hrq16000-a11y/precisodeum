
-- Add new columns to sponsors table for the 3-tier system
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS sponsor_type text NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS short_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS full_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp text DEFAULT '',
  ADD COLUMN IF NOT EXISTS external_link text DEFAULT '',
  ADD COLUMN IF NOT EXISTS linked_city text DEFAULT '',
  ADD COLUMN IF NOT EXISTS linked_category text DEFAULT '',
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS badge_type text NOT NULL DEFAULT 'Patrocinado',
  ADD COLUMN IF NOT EXISTS company_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Create sponsor slot limits table for scarcity control
CREATE TABLE IF NOT EXISTS public.sponsor_slot_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type text NOT NULL DEFAULT 'global',
  context_value text NOT NULL DEFAULT '',
  max_slots integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(context_type, context_value)
);

ALTER TABLE public.sponsor_slot_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Slot limits viewable by everyone"
  ON public.sponsor_slot_limits FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage slot limits"
  ON public.sponsor_slot_limits FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default slot limits
INSERT INTO public.sponsor_slot_limits (context_type, context_value, max_slots)
VALUES 
  ('global', '', 1),
  ('city', '_default', 3),
  ('category', '_default', 3)
ON CONFLICT (context_type, context_value) DO NOTHING;
