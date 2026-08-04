-- 1) Perfis: além de role/permissions/staff_role/commercial_plan, reverter também
-- os campos de moderação quando o autor não é admin/service_role.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.permissions IS DISTINCT FROM OLD.permissions
     OR NEW.staff_role IS DISTINCT FROM OLD.staff_role
     OR NEW.commercial_plan IS DISTINCT FROM OLD.commercial_plan
  THEN
    RAISE EXCEPTION 'cannot modify privileged profile columns'
      USING ERRCODE = '42501';
  END IF;

  -- Campos de moderação: revertidos silenciosamente (nunca auto-editáveis).
  NEW.is_suspicious      := OLD.is_suspicious;
  NEW.suspended_at       := OLD.suspended_at;
  NEW.suspended_reason   := OLD.suspended_reason;
  NEW.banned_at          := OLD.banned_at;

  RETURN NEW;
END;
$$;

-- 2) Prestadores: reverter tentativas de auto-aprovação/verificação/plano/destaque.
-- Roda ANTES dos demais triggers (nome ordena primeiro), então rotinas internas
-- como auto_approve_provider continuam funcionando normalmente.
CREATE OR REPLACE FUNCTION public.guard_provider_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.status              := OLD.status;
  NEW.is_verified         := OLD.is_verified;
  NEW.verified_manual     := OLD.verified_manual;
  NEW.verified_by         := OLD.verified_by;
  NEW.community_verified  := OLD.community_verified;
  NEW.plan                := OLD.plan;
  NEW.featured            := OLD.featured;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_a_guard_provider_privileged ON public.providers;
CREATE TRIGGER trg_a_guard_provider_privileged
BEFORE UPDATE ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.guard_provider_privileged_columns();
