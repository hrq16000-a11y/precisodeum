
-- 1. Create tier_rules table
CREATE TABLE public.tier_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key text NOT NULL UNIQUE,
  tier_label text NOT NULL DEFAULT '',
  max_services integer NOT NULL DEFAULT 0,
  max_leads integer NOT NULL DEFAULT 0,
  can_create_services boolean NOT NULL DEFAULT false,
  can_receive_leads boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Seed with current hardcoded values
INSERT INTO public.tier_rules (tier_key, tier_label, max_services, max_leads, can_create_services, can_receive_leads) VALUES
  ('premium', 'Premium', -1, -1, true, true),
  ('free_provider', 'Profissional Grátis', 3, 20, true, false),
  ('free_client', 'Cliente Grátis', 0, 5, false, false),
  ('free_rh', 'Agência/RH Grátis', 0, 5, false, false),
  ('other', 'Outro', 0, 0, false, false);

-- 3. Enable RLS
ALTER TABLE public.tier_rules ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "Tier rules viewable by authenticated" ON public.tier_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert tier rules" ON public.tier_rules
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tier rules" ON public.tier_rules
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tier rules" ON public.tier_rules
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 5. Replace account_limits_view to read from tier_rules
CREATE OR REPLACE VIEW public.account_limits_view AS
SELECT
  amv.user_ref,
  amv.email,
  amv.account_tier,
  COALESCE(tr.max_services, 0) AS max_services,
  COALESCE(tr.max_leads, 0) AS max_leads,
  COALESCE(tr.can_receive_leads, false) AS can_receive_leads,
  COALESCE(tr.can_create_services, false) AS can_create_services
FROM account_model_view amv
LEFT JOIN tier_rules tr ON tr.tier_key = amv.account_tier;
