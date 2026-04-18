-- 1. Update level thresholds to the new official scale
UPDATE public.gamification_levels SET min_points = 0    WHERE name = 'Iniciante';
UPDATE public.gamification_levels SET min_points = 100  WHERE name = 'Entusiasta';
UPDATE public.gamification_levels SET min_points = 300  WHERE name = 'Engajado';
UPDATE public.gamification_levels SET min_points = 700  WHERE name = 'Ouro';
UPDATE public.gamification_levels SET min_points = 1500 WHERE name = 'Platina';
UPDATE public.gamification_levels SET min_points = 3000 WHERE name = 'Diamante';
UPDATE public.gamification_levels SET min_points = 5000 WHERE name = 'Mestre';

-- 2. Ensure auto-level trigger exists on profiles (drop old duplicates, recreate canonical one)
DROP TRIGGER IF EXISTS trg_auto_level_on_points ON public.profiles;
DROP TRIGGER IF EXISTS trg_auto_level_on_points_change ON public.profiles;

CREATE TRIGGER trg_auto_level_on_points_change
AFTER UPDATE OF engagement_points ON public.profiles
FOR EACH ROW
WHEN (OLD.engagement_points IS DISTINCT FROM NEW.engagement_points)
EXECUTE FUNCTION public.trg_auto_level_on_points_change();

-- 3. Recalculate level_id for ALL existing users based on current points and new thresholds
UPDATE public.profiles p
SET level_id = (
  SELECT gl.id FROM public.gamification_levels gl
  WHERE gl.active = true AND COALESCE(p.engagement_points, 0) >= gl.min_points
  ORDER BY gl.min_points DESC
  LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM public.gamification_levels WHERE active = true);