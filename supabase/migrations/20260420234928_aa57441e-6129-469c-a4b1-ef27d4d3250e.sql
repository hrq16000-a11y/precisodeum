-- Desativar itens removidos
UPDATE public.ui_bottom_nav_items SET is_active = false
WHERE label IN ('Como Funciona', 'Sobre');

-- Renomear "Home" para "Início" e ajustar order
UPDATE public.ui_bottom_nav_items
SET label = 'Início', order_index = 0
WHERE label = 'Home';

-- Inserir Buscar (se não existir)
INSERT INTO public.ui_bottom_nav_items (config_id, label, icon, route_path, action_type, order_index, size, is_active, requires_auth)
SELECT config_id, 'Buscar', 'Search', '/buscar', 'route', 1, 'medium', true, false
FROM public.ui_bottom_nav_items
WHERE label = 'Início'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Inserir Chat (se não existir)
INSERT INTO public.ui_bottom_nav_items (config_id, label, icon, route_path, action_type, order_index, size, is_active, requires_auth)
SELECT config_id, 'Chat', 'MessageCircle', '/dashboard/chat', 'route', 3, 'medium', true, true
FROM public.ui_bottom_nav_items
WHERE label = 'Início'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Reordenar: Criar fica no centro (2), Perfil fica no fim (4)
UPDATE public.ui_bottom_nav_items SET order_index = 2 WHERE label = 'Criar' AND is_active = true;
UPDATE public.ui_bottom_nav_items SET order_index = 4 WHERE label = 'Perfil' AND is_active = true;