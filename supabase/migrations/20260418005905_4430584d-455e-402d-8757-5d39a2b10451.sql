
-- 1. Reset completo dos níveis de gamificação
-- Primeiro, remover refs em profile_type_settings
UPDATE public.profile_type_settings SET default_level_id = NULL;

-- Limpar level_id em profiles temporariamente
UPDATE public.profiles SET level_id = NULL;

-- Deletar níveis antigos
DELETE FROM public.gamification_levels;

-- Inserir os 7 novos níveis
INSERT INTO public.gamification_levels (name, min_points, max_points, priority, color, icon, badge_class, active, benefits) VALUES
('Iniciante', 0, 19, 10, '#94a3b8', 'Sparkles', 'bg-slate-100 text-slate-700', true, '["Perfil ativo na plataforma"]'::jsonb),
('Entusiasta', 20, 49, 20, '#22c55e', 'Leaf', 'bg-green-100 text-green-700', true, '["Listagem em buscas locais", "Selo de Entusiasta"]'::jsonb),
('Engajado', 50, 99, 30, '#3b82f6', 'Zap', 'bg-blue-100 text-blue-700', true, '["Maior visibilidade na home", "Selo de Engajado"]'::jsonb),
('Ouro', 100, 199, 40, '#f59e0b', 'Trophy', 'bg-amber-100 text-amber-800', true, '["Destaque dourado nos cards", "Prioridade em buscas", "Selo de Ouro"]'::jsonb),
('Platina', 200, 399, 50, '#06b6d4', 'Star', 'bg-cyan-100 text-cyan-800', true, '["Selo Platina exclusivo", "Posicionamento premium"]'::jsonb),
('Diamante', 400, 699, 60, '#8b5cf6', 'Gem', 'bg-purple-100 text-purple-800', true, '["Card com borda diamante", "Topo das listagens", "Selo Diamante"]'::jsonb),
('Mestre', 700, NULL, 70, '#dc2626', 'Crown', 'bg-gradient-to-r from-amber-400 to-red-500 text-white', true, '["Selo Mestre vitalício", "Destaque máximo na plataforma", "Card premium animado"]'::jsonb);

-- 2. Limpar account_types inativos
DELETE FROM public.account_types WHERE active = false;

-- 3. Recalcular pontos e níveis de todos os profissionais
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.profiles LOOP
    PERFORM public.recalculate_engagement_points(rec.id);
    PERFORM public.calculate_user_level(rec.id);
  END LOOP;
END $$;

-- 4. Garantir trigger de auto-cálculo de nível ao mudar pontos (já existe trg_auto_level_on_points_change)
DROP TRIGGER IF EXISTS trg_auto_level_on_points_change ON public.profiles;
CREATE TRIGGER trg_auto_level_on_points_change
AFTER UPDATE OF engagement_points ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_level_on_points_change();

-- 5. Função de admin para recalcular tudo de uma vez (admin-only)
CREATE OR REPLACE FUNCTION public.admin_recalculate_all_engagement()
RETURNS TABLE(processed_count integer, total_points bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  cnt integer := 0;
  total bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  FOR rec IN SELECT id FROM public.profiles LOOP
    PERFORM public.recalculate_engagement_points(rec.id);
    PERFORM public.calculate_user_level(rec.id);
    cnt := cnt + 1;
  END LOOP;

  SELECT COALESCE(SUM(engagement_points), 0) INTO total FROM public.profiles;
  RETURN QUERY SELECT cnt, total;
END;
$$;

-- 6. Função para contar usuários por nível (admin-only)
CREATE OR REPLACE FUNCTION public.admin_get_level_distribution()
RETURNS TABLE(level_id uuid, level_name text, level_color text, level_icon text, min_points integer, user_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gl.id, gl.name, gl.color, gl.icon, gl.min_points,
    COUNT(p.id) AS user_count
  FROM public.gamification_levels gl
  LEFT JOIN public.profiles p ON p.level_id = gl.id
  WHERE gl.active = true AND public.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY gl.id, gl.name, gl.color, gl.icon, gl.min_points, gl.priority
  ORDER BY gl.min_points ASC;
$$;
