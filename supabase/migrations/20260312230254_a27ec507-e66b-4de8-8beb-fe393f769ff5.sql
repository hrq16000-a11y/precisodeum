
-- Cities table
CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  state text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cities are viewable by everyone" ON public.cities FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert cities" ON public.cities FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update cities" ON public.cities FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete cities" ON public.cities FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Neighborhoods table
CREATE TABLE public.neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(city_id, slug)
);

ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Neighborhoods are viewable by everyone" ON public.neighborhoods FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert neighborhoods" ON public.neighborhoods FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update neighborhoods" ON public.neighborhoods FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete neighborhoods" ON public.neighborhoods FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add geo fields to providers
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS response_time text;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS service_radius text;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS working_hours text;

-- Seed major Brazilian cities
INSERT INTO public.cities (name, state, slug) VALUES
  ('São Paulo', 'SP', 'sao-paulo'),
  ('Rio de Janeiro', 'RJ', 'rio-de-janeiro'),
  ('Curitiba', 'PR', 'curitiba'),
  ('Belo Horizonte', 'MG', 'belo-horizonte'),
  ('Florianópolis', 'SC', 'florianopolis'),
  ('Porto Alegre', 'RS', 'porto-alegre'),
  ('Brasília', 'DF', 'brasilia'),
  ('Salvador', 'BA', 'salvador'),
  ('Fortaleza', 'CE', 'fortaleza'),
  ('Recife', 'PE', 'recife'),
  ('Goiânia', 'GO', 'goiania'),
  ('Manaus', 'AM', 'manaus'),
  ('Belém', 'PA', 'belem'),
  ('Campinas', 'SP', 'campinas'),
  ('São José dos Campos', 'SP', 'sao-jose-dos-campos'),
  ('Joinville', 'SC', 'joinville'),
  ('Londrina', 'PR', 'londrina'),
  ('Maringá', 'PR', 'maringa'),
  ('Vitória', 'ES', 'vitoria'),
  ('Natal', 'RN', 'natal')
ON CONFLICT (slug) DO NOTHING;
