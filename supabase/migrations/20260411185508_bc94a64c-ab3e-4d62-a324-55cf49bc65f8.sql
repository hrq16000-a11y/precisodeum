
ALTER TABLE public.highlights ADD COLUMN IF NOT EXISTS icon text DEFAULT 'Sparkles';
ALTER TABLE public.highlights ADD COLUMN IF NOT EXISTS theme_color text DEFAULT 'text-orange-500';
ALTER TABLE public.highlights ADD COLUMN IF NOT EXISTS button_text text DEFAULT 'Saiba mais';

INSERT INTO public.highlights (title, description, icon, theme_color, button_text, link_url, display_order, active)
VALUES
  ('Lucro 100% Seu', 'Não cobramos comissão sobre os serviços que você fecha através da plataforma.', 'Sparkles', 'text-orange-500', 'Saiba mais →', '/cadastro', 1, true),
  ('Contato Direto', 'O cliente clica, o seu WhatsApp toca. Sem intermediários atrapalhando o negócio.', 'Smartphone', 'text-blue-500', 'Como funciona →', '/como-funciona', 2, true),
  ('Transparência Total', 'Você negocia valores e prazos direto com o cliente. O acordo é 100% entre vocês.', 'Handshake', 'text-emerald-500', 'Ver vantagens →', '/vantagens', 3, true);
