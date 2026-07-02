-- 1) Índice único parcial para evitar min_points duplicado em níveis ATIVOS
CREATE UNIQUE INDEX IF NOT EXISTS uq_gamification_levels_active_minpoints
  ON public.gamification_levels (min_points)
  WHERE active = true;

-- 2) Trigger de auditoria
CREATE OR REPLACE FUNCTION public.audit_gamification_levels()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_target uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create'; v_target := NEW.id;
    v_old := NULL; v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update'; v_target := NEW.id;
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
  ELSE
    v_action := 'delete'; v_target := OLD.id;
    v_old := to_jsonb(OLD); v_new := NULL;
  END IF;

  BEGIN
    INSERT INTO public.audit_log (actor_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), v_action, 'gamification_level', v_target,
            jsonb_build_object('old', v_old, 'new', v_new));
  EXCEPTION WHEN OTHERS THEN
    -- não bloqueia operação se audit_log não estiver disponível
    NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_gamification_levels ON public.gamification_levels;
CREATE TRIGGER trg_audit_gamification_levels
AFTER INSERT OR UPDATE OR DELETE ON public.gamification_levels
FOR EACH ROW EXECUTE FUNCTION public.audit_gamification_levels();