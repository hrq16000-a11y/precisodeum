
-- 1. Add commercial fields to sponsors
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS cnpj text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text DEFAULT '';

-- 2. Sponsor Regions (Praças de atuação / Exclusividade regional)
CREATE TABLE IF NOT EXISTS public.sponsor_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  state_uf text,
  exclusive boolean DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sponsor_regions"
  ON public.sponsor_regions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sponsors view own regions"
  ON public.sponsor_regions FOR SELECT
  TO authenticated
  USING (
    sponsor_id IN (
      SELECT sc.sponsor_id FROM public.sponsor_contacts sc WHERE sc.user_id = auth.uid()
    )
  );

CREATE TRIGGER update_sponsor_regions_updated_at
  BEFORE UPDATE ON public.sponsor_regions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Sponsor Plans (Planos de patrocínio)
CREATE TABLE IF NOT EXISTS public.sponsor_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text DEFAULT '',
  price_monthly numeric(10,2) DEFAULT 0,
  price_yearly numeric(10,2) DEFAULT 0,
  max_impressions integer DEFAULT -1,
  max_slots integer DEFAULT 1,
  features jsonb DEFAULT '[]'::jsonb,
  active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active sponsor plans"
  ON public.sponsor_plans FOR SELECT
  USING (active = true);

CREATE POLICY "Admins manage sponsor_plans"
  ON public.sponsor_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_sponsor_plans_updated_at
  BEFORE UPDATE ON public.sponsor_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Sponsor Subscriptions (Assinaturas de patrocinadores)
CREATE TABLE IF NOT EXISTS public.sponsor_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.sponsor_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  current_period_start timestamptz,
  current_period_end timestamptz,
  amount_paid numeric(10,2) DEFAULT 0,
  payment_method text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sponsor_subscriptions"
  ON public.sponsor_subscriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sponsors view own subscriptions"
  ON public.sponsor_subscriptions FOR SELECT
  TO authenticated
  USING (
    sponsor_id IN (
      SELECT sc.sponsor_id FROM public.sponsor_contacts sc WHERE sc.user_id = auth.uid()
    )
  );

CREATE TRIGGER update_sponsor_subscriptions_updated_at
  BEFORE UPDATE ON public.sponsor_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial sponsor plans
INSERT INTO public.sponsor_plans (name, slug, description, price_monthly, price_yearly, max_impressions, max_slots, features, display_order) VALUES
  ('Banner Básico', 'banner-basico', 'Banner em 1 posição fixa do site', 199.90, 1999.00, 50000, 1, '["1 banner","Relatório mensal","Suporte por email"]'::jsonb, 1),
  ('Destaque Regional', 'destaque-regional', 'Exclusividade em cidades ou estados selecionados', 499.90, 4999.00, 150000, 3, '["Até 3 banners","Exclusividade regional","Dashboard de métricas","Suporte prioritário"]'::jsonb, 2),
  ('Premium Nacional', 'premium-nacional', 'Presença em todas as páginas com máxima visibilidade', 999.90, 9999.00, -1, 6, '["Até 6 banners","Impressões ilimitadas","Posições premium","Dashboard completo","Gerente de conta"]'::jsonb, 3),
  ('Showcase Pro', 'showcase-pro', 'Carrossel de destaque + card nativo em listagens', 699.90, 6999.00, 200000, 4, '["Carrossel destaque","Card nativo","4 posições","Segmentação por categoria"]'::jsonb, 4)
ON CONFLICT (slug) DO NOTHING;
