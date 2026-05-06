
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT 'true',
  label text NOT NULL DEFAULT '',
  description text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site settings viewable by everyone"
  ON public.site_settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can update site settings"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert site settings"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete site settings"
  ON public.site_settings FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO site_settings (key, value, label, description) VALUES
  ('reviews_enabled', 'false', 'Avaliações', 'Exibir seção de avaliações no site'),
  ('leads_enabled', 'true', 'Solicitação de Orçamento', 'Permitir envio de leads/orçamentos'),
  ('portfolio_enabled', 'true', 'Portfólio', 'Exibir seção de portfólio nos perfis');
