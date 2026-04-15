
-- ============================================================
-- FASE 1: Desativar triggers de upsell (Soft Deprecation)
-- ============================================================

-- Remove upsell triggers (tabelas e funções permanecem intactas)
DROP TRIGGER IF EXISTS trg_upsell_service ON public.services;
DROP TRIGGER IF EXISTS trg_upsell_lead ON public.leads;

-- ============================================================
-- FASE 2: Motor de Gamificação
-- ============================================================

-- 1. Tabela de níveis de gamificação
CREATE TABLE IF NOT EXISTS public.gamification_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '🥉',
  color text NOT NULL DEFAULT '#6b7280',
  min_points integer NOT NULL DEFAULT 0,
  max_points integer, -- NULL = infinito (nível máximo)
  priority integer NOT NULL DEFAULT 0,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  badge_class text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gamification_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gamification levels viewable by everyone"
  ON public.gamification_levels FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage gamification levels"
  ON public.gamification_levels FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Tabela de regras de pontuação
CREATE TABLE IF NOT EXISTS public.score_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL UNIQUE,
  label text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  cooldown_hours integer DEFAULT NULL,
  max_per_day integer DEFAULT NULL,
  active boolean NOT NULL DEFAULT true,
  category text NOT NULL DEFAULT 'engagement',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.score_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Score rules viewable by everyone"
  ON public.score_rules FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage score rules"
  ON public.score_rules FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Função para obter nível baseado em pontos
CREATE OR REPLACE FUNCTION public.get_gamification_level(_points integer)
RETURNS TABLE(level_name text, level_icon text, level_color text, level_badge_class text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT name, icon, color, badge_class
  FROM gamification_levels
  WHERE active = true AND _points >= min_points
  ORDER BY min_points DESC
  LIMIT 1;
$$;

-- 4. Seed: 5 níveis de gamificação
INSERT INTO public.gamification_levels (name, icon, color, min_points, max_points, priority, badge_class, benefits) VALUES
  ('Bronze', '🥉', '#CD7F32', 0, 29, 10, 'bg-amber-900/20 text-amber-700 border-amber-700/30', '["Perfil visível nas buscas", "Receber leads básicos"]'::jsonb),
  ('Prata', '🥈', '#C0C0C0', 30, 69, 20, 'bg-gray-200/30 text-gray-600 border-gray-400/40', '["Destaque leve nas buscas", "Badge de perfil engajado"]'::jsonb),
  ('Ouro', '🥇', '#FFD700', 70, 149, 30, 'bg-yellow-400/20 text-yellow-700 border-yellow-500/40', '["Prioridade nas buscas", "Badge dourado", "Selo de confiança"]'::jsonb),
  ('Diamante', '💎', '#B9F2FF', 150, 299, 40, 'bg-cyan-400/20 text-cyan-700 border-cyan-400/40', '["Destaque máximo", "Primeiro nas buscas locais", "Badge diamante"]'::jsonb),
  ('Mestre', '👑', '#9333EA', 300, NULL, 50, 'bg-purple-500/20 text-purple-700 border-purple-500/40', '["Topo absoluto do ranking", "Perfil premium visual", "Selo mestre verificado"]'::jsonb);

-- 5. Seed: 12 regras de pontuação
INSERT INTO public.score_rules (action_key, label, points, description, category) VALUES
  ('profile_photo', 'Adicionar foto de perfil', 10, 'Upload de foto/avatar profissional', 'perfil'),
  ('profile_description', 'Preencher descrição', 10, 'Descrição com mais de 50 caracteres', 'perfil'),
  ('first_service', 'Cadastrar primeiro serviço', 15, 'Cadastro do primeiro serviço ativo', 'servicos'),
  ('extra_service', 'Cadastrar serviço adicional', 5, 'Cada serviço extra cadastrado (máx 4)', 'servicos'),
  ('portfolio_album', 'Criar álbum de portfólio', 10, 'Cada álbum criado (máx 3)', 'portfolio'),
  ('portfolio_photos', 'Adicionar 5 fotos ao portfólio', 5, 'A cada 5 fotos adicionadas (máx 4x)', 'portfolio'),
  ('receive_lead', 'Receber um lead', 3, 'Cada lead recebido (máx 10)', 'leads'),
  ('receive_review', 'Receber avaliação', 5, 'Cada avaliação recebida (máx 5)', 'avaliacoes'),
  ('five_star_review', 'Avaliação 5 estrelas', 10, 'Bônus por avaliação máxima', 'avaliacoes'),
  ('complete_profile', 'Perfil 100% completo', 20, 'Todos os campos preenchidos', 'perfil'),
  ('weekly_active', 'Atividade semanal', 5, 'Login pelo menos 1x por semana', 'engagement'),
  ('share_profile', 'Compartilhar perfil', 3, 'Compartilhar link do perfil', 'engagement');

-- 6. Trigger updated_at para ambas as tabelas
CREATE TRIGGER update_gamification_levels_updated_at
  BEFORE UPDATE ON public.gamification_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_score_rules_updated_at
  BEFORE UPDATE ON public.score_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
