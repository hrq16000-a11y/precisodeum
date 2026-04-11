INSERT INTO public.site_settings (key, value, is_public)
VALUES 
  ('header_compact_enabled', 'true', true),
  ('header_compact_height', '56', true),
  ('header_compact_bg', '', true)
ON CONFLICT (key) DO NOTHING;