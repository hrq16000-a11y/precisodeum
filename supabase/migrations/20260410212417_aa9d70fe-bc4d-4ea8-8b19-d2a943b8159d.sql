-- Clear existing footer items (they were policy links, already hardcoded in footer bottom)
DELETE FROM menu_items WHERE menu_location = 'footer';

-- PROFISSIONAIS section (footer location)
INSERT INTO menu_items (menu_location, label, url, icon, display_order, active, open_in_new_tab) VALUES
('footer', 'Cadastro', '/cadastro', '📝', 0, true, false),
('footer', 'Login', '/login', '🔑', 1, true, false),
('footer', 'Dashboard', '/dashboard', '📊', 2, true, false),
('footer', 'Buscar Profissionais', '/buscar', '🔍', 3, true, false),
('footer', 'Vagas', '/vagas', '💼', 4, true, false),
('footer', 'Notícias', '/blog', '📰', 5, true, false),
('footer', 'Sobre', '/sobre', 'ℹ️', 6, true, false);

-- ECOSSISTEMA section
INSERT INTO menu_items (menu_location, label, url, icon, display_order, active, open_in_new_tab) VALUES
('footer_eco', 'Mestre dos Serviços', 'https://mestredosservicos.com.br', '🌐', 0, true, true),
('footer_eco', 'Encontre um Técnico', 'https://www.encontreumtecnico.com', '🌐', 1, true, true),
('footer_eco', 'Preciso de um Técnico', 'https://www.precisodeumtecnico.com', '🌐', 2, true, true),
('footer_eco', 'Encontre um Profissional', 'https://www.encontreumprofissional.com.br', '🌐', 3, true, true),
('footer_eco', 'Preciso de um Profissional', 'https://www.precisodeumprofissional.com.br', '🌐', 4, true, true),
('footer_eco', 'TamoNaWeb', 'https://www.TamoNaWeb.com.br', '🆕', 5, true, true);

-- SUPORTE section
INSERT INTO menu_items (menu_location, label, url, icon, display_order, active, open_in_new_tab) VALUES
('footer_suporte', '(41) 99745-2053', 'https://wa.me/5541997452053', '💬', 0, true, true);