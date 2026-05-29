INSERT INTO public.site_settings (key, value, updated_at)
VALUES
  ('app_min_version', to_jsonb('1.2.0'::text), now()),
  ('app_latest_version', to_jsonb('1.2.0'::text), now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();