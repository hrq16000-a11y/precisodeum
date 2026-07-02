-- Provider Impressions table
CREATE TABLE public.provider_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  impressions integer NOT NULL DEFAULT 0,
  UNIQUE(provider_id, date)
);

ALTER TABLE public.provider_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Impressions viewable by everyone"
ON public.provider_impressions FOR SELECT TO public
USING (true);

CREATE POLICY "Admins can manage impressions"
ON public.provider_impressions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert impressions"
ON public.provider_impressions FOR INSERT TO authenticated
WITH CHECK (true);

CREATE INDEX idx_provider_impressions_lookup
ON public.provider_impressions (provider_id, date);

-- Function to increment impression
CREATE OR REPLACE FUNCTION public.increment_provider_impression(_provider_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO provider_impressions (provider_id, date, impressions)
  VALUES (_provider_id, CURRENT_DATE, 1)
  ON CONFLICT (provider_id, date)
  DO UPDATE SET impressions = provider_impressions.impressions + 1;
END;
$$;

-- Ranking config settings
INSERT INTO public.site_settings (key, value, label, description, is_public)
VALUES
  ('ranking_boost_multiplier', '20', 'Multiplicador do Boost', 'Peso do boost pago no ranking (padrão: 20)', false),
  ('ranking_fairness_penalty', '5', 'Penalidade de Fairness', 'Peso da penalidade por exposição (padrão: 5)', false),
  ('ranking_random_factor', '5', 'Fator Aleatório', 'Variação máxima de randomização no ranking (padrão: 5)', false)
ON CONFLICT (key) DO NOTHING;