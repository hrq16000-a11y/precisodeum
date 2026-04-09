
-- 1. Create states reference table
CREATE TABLE IF NOT EXISTS public.states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  uf text NOT NULL UNIQUE,
  region text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "States viewable by everyone" ON public.states FOR SELECT USING (true);
CREATE POLICY "Admins can manage states" ON public.states FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert all 27 Brazilian states
INSERT INTO public.states (name, uf, region) VALUES
  ('Acre', 'AC', 'Norte'),
  ('Alagoas', 'AL', 'Nordeste'),
  ('Amapá', 'AP', 'Norte'),
  ('Amazonas', 'AM', 'Norte'),
  ('Bahia', 'BA', 'Nordeste'),
  ('Ceará', 'CE', 'Nordeste'),
  ('Distrito Federal', 'DF', 'Centro-Oeste'),
  ('Espírito Santo', 'ES', 'Sudeste'),
  ('Goiás', 'GO', 'Centro-Oeste'),
  ('Maranhão', 'MA', 'Nordeste'),
  ('Mato Grosso', 'MT', 'Centro-Oeste'),
  ('Mato Grosso do Sul', 'MS', 'Centro-Oeste'),
  ('Minas Gerais', 'MG', 'Sudeste'),
  ('Pará', 'PA', 'Norte'),
  ('Paraíba', 'PB', 'Nordeste'),
  ('Paraná', 'PR', 'Sul'),
  ('Pernambuco', 'PE', 'Nordeste'),
  ('Piauí', 'PI', 'Nordeste'),
  ('Rio de Janeiro', 'RJ', 'Sudeste'),
  ('Rio Grande do Norte', 'RN', 'Nordeste'),
  ('Rio Grande do Sul', 'RS', 'Sul'),
  ('Rondônia', 'RO', 'Norte'),
  ('Roraima', 'RR', 'Norte'),
  ('Santa Catarina', 'SC', 'Sul'),
  ('São Paulo', 'SP', 'Sudeste'),
  ('Sergipe', 'SE', 'Nordeste'),
  ('Tocantins', 'TO', 'Norte')
ON CONFLICT (uf) DO NOTHING;

-- 2. Add columns to cities table
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS state_uf text DEFAULT '';
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS ibge_code text DEFAULT '';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cities_state_uf ON public.cities (state_uf);
CREATE INDEX IF NOT EXISTS idx_cities_name ON public.cities (name);
CREATE INDEX IF NOT EXISTS idx_cities_state_uf_name ON public.cities (state_uf, name);
CREATE INDEX IF NOT EXISTS idx_cities_ibge_code ON public.cities (ibge_code);

-- 3. Create view for city provider stats
CREATE OR REPLACE VIEW public.city_provider_stats AS
SELECT 
  c.id as city_id,
  c.name as city_name,
  c.slug as city_slug,
  c.state_uf,
  COUNT(p.id) FILTER (WHERE p.status = 'approved' AND p.deleted_at IS NULL) as providers_count,
  COUNT(p.id) FILTER (WHERE p.status = 'approved' AND p.deleted_at IS NULL) > 0 as has_active_providers
FROM public.cities c
LEFT JOIN public.providers p ON UPPER(TRIM(p.city)) = UPPER(TRIM(c.name)) 
  AND UPPER(TRIM(p.state)) = c.state_uf
GROUP BY c.id, c.name, c.slug, c.state_uf;

-- 4. Normalize existing providers.state to UF
UPDATE public.providers SET state = 'PR' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('PR', 'PARANA', 'PARANÁ', 'PR  PARANÁ', 'PR PARANA');
UPDATE public.providers SET state = 'SP' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('SP', 'SAO PAULO', 'SÃO PAULO');
UPDATE public.providers SET state = 'RJ' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('RJ', 'RIO DE JANEIRO');
UPDATE public.providers SET state = 'SC' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('SC', 'SANTA CATARINA');
UPDATE public.providers SET state = 'RS' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('RS', 'RIO GRANDE DO SUL');
UPDATE public.providers SET state = 'MG' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('MG', 'MINAS GERAIS');
UPDATE public.providers SET state = 'BA' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('BA', 'BAHIA');
UPDATE public.providers SET state = 'GO' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('GO', 'GOIAS', 'GOIÁS');
UPDATE public.providers SET state = 'PE' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('PE', 'PERNAMBUCO');
UPDATE public.providers SET state = 'PI' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('PI', 'PIAUÍ', 'PIAUI');
UPDATE public.providers SET state = 'AL' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('AL', 'ALAGOAS');
UPDATE public.providers SET state = 'AM' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('AM', 'AMAZONAS');
UPDATE public.providers SET state = 'PA' WHERE UPPER(TRIM(REGEXP_REPLACE(state, '[^a-zA-ZÀ-ú ]', '', 'g'))) IN ('PA', 'PARÁ', 'PARA');

-- Update existing cities state_uf from state field
UPDATE public.cities SET state_uf = UPPER(TRIM(state)) WHERE state_uf = '' OR state_uf IS NULL;
