INSERT INTO public.site_settings (key, label, description, value, is_public)
VALUES (
  'home_categories_rotation_strategy',
  'Estratégia de rotação das Categorias na Home',
  'Define como as categorias da home são embaralhadas: daily (mesma ordem por dia/cidade), session (nova ordem a cada sessão) ou fixed (sempre na mesma ordem alfabética).',
  'daily',
  true
)
ON CONFLICT (key) DO NOTHING;