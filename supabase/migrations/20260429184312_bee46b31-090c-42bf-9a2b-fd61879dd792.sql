
INSERT INTO public.site_settings (key, value, description)
VALUES
  ('email_from', '"Preciso de Um <onboarding@resend.dev>"'::jsonb, 'Remetente padrao usado pela edge function send-email. Trocar para contato@precisodeum.com.br apos verificacao do dominio na Resend.'),
  ('email_reply_to', '"contato@precisodeum.com.br"'::jsonb, 'Reply-To padrao das mensagens transacionais.')
ON CONFLICT (key) DO NOTHING;
