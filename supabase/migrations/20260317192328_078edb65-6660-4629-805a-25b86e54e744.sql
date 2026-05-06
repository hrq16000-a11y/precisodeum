INSERT INTO public.site_settings (key, label, value, description)
VALUES 
  ('logo_url', 'Logo do Site', '', 'URL da logo exibida no cabeçalho e rodapé'),
  ('logo_footer_url', 'Logo do Rodapé', '', 'URL da logo exibida no rodapé (versão vertical/clara)')
ON CONFLICT (key) DO NOTHING;