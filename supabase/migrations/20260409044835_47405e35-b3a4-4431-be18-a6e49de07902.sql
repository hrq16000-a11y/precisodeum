INSERT INTO public.site_settings (key, value, label, description, is_public)
VALUES (
  'module_hero_banners',
  'false',
  'Bloco de Banners CMS (abaixo do Hero)',
  'Exibe o carrossel de banners do CMS logo abaixo da hero principal na homepage',
  true
)
ON CONFLICT (key) DO UPDATE SET value = 'false', label = EXCLUDED.label, description = EXCLUDED.description;