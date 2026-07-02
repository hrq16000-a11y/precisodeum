-- Configurações de versão remota do app (Remote Config "estilo Mercado Livre")
INSERT INTO public.site_settings (key, value) VALUES
  ('app_min_version', '0.0.0'),
  ('app_latest_version', '0.0.0'),
  ('app_update_force_message', 'Para continuar usando o Preciso de Um, instale a versão mais recente. Esta atualização traz correções importantes de segurança e estabilidade.'),
  ('app_update_suggest_message', 'Uma nova versão do Preciso de Um está disponível com melhorias de performance e novidades.')
ON CONFLICT (key) DO NOTHING;

-- RPC pública para o app consultar a configuração de versão (sem expor outras settings)
CREATE OR REPLACE FUNCTION public.get_app_version_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'min_version', COALESCE((SELECT value FROM site_settings WHERE key = 'app_min_version'), '0.0.0'),
    'latest_version', COALESCE((SELECT value FROM site_settings WHERE key = 'app_latest_version'), '0.0.0'),
    'force_message', COALESCE((SELECT value FROM site_settings WHERE key = 'app_update_force_message'), ''),
    'suggest_message', COALESCE((SELECT value FROM site_settings WHERE key = 'app_update_suggest_message'), ''),
    'checked_at', now()
  )
$$;

GRANT EXECUTE ON FUNCTION public.get_app_version_config() TO anon, authenticated;