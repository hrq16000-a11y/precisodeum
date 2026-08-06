-- 1) Helper de auditoria: registra tentativas negadas de alterar campos privilegiados
CREATE OR REPLACE FUNCTION public.audit_privileged_revert(
  _entity_type text,
  _entity_id text,
  _target_user_id uuid,
  _attempted jsonb,
  _kept jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _attempted IS NULL OR _attempted = '{}'::jsonb THEN
    RETURN;
  END IF;
  INSERT INTO public.system_audit_logs (
    staff_id, action, entity_type, entity_id, target_user_id,
    old_values, new_values, context_metadata
  ) VALUES (
    auth.uid(), 'privileged_change_denied', _entity_type, _entity_id, _target_user_id,
    _kept, _attempted,
    jsonb_build_object('source', 'db_trigger', 'auth_role', auth.role())
  );
EXCEPTION WHEN OTHERS THEN
  RETURN; -- auditoria nunca pode quebrar a operação do usuário
END;
$$;

REVOKE ALL ON FUNCTION public.audit_privileged_revert(text, text, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- 2) profiles
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempted jsonb := '{}'::jsonb;
  kept jsonb := '{}'::jsonb;
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.permissions IS DISTINCT FROM OLD.permissions
     OR NEW.staff_role IS DISTINCT FROM OLD.staff_role
     OR NEW.commercial_plan IS DISTINCT FROM OLD.commercial_plan
  THEN
    PERFORM public.audit_privileged_revert(
      'profiles', OLD.id::text, OLD.id,
      jsonb_build_object('role', NEW.role, 'permissions', NEW.permissions,
                         'staff_role', NEW.staff_role, 'commercial_plan', NEW.commercial_plan),
      jsonb_build_object('role', OLD.role, 'permissions', OLD.permissions,
                         'staff_role', OLD.staff_role, 'commercial_plan', OLD.commercial_plan)
    );
    RAISE EXCEPTION 'cannot modify privileged profile columns' USING ERRCODE = '42501';
  END IF;

  IF NEW.is_suspicious IS DISTINCT FROM OLD.is_suspicious THEN
    attempted := attempted || jsonb_build_object('is_suspicious', NEW.is_suspicious);
    kept := kept || jsonb_build_object('is_suspicious', OLD.is_suspicious);
  END IF;
  IF NEW.suspended_at IS DISTINCT FROM OLD.suspended_at THEN
    attempted := attempted || jsonb_build_object('suspended_at', NEW.suspended_at);
    kept := kept || jsonb_build_object('suspended_at', OLD.suspended_at);
  END IF;
  IF NEW.banned_at IS DISTINCT FROM OLD.banned_at THEN
    attempted := attempted || jsonb_build_object('banned_at', NEW.banned_at);
    kept := kept || jsonb_build_object('banned_at', OLD.banned_at);
  END IF;

  NEW.is_suspicious    := OLD.is_suspicious;
  NEW.suspended_at     := OLD.suspended_at;
  NEW.suspended_reason := OLD.suspended_reason;
  NEW.banned_at        := OLD.banned_at;

  PERFORM public.audit_privileged_revert('profiles', OLD.id::text, OLD.id, attempted, kept);
  RETURN NEW;
END;
$$;

-- 3) providers
CREATE OR REPLACE FUNCTION public.guard_provider_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempted jsonb := '{}'::jsonb;
  kept jsonb := '{}'::jsonb;
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    attempted := attempted || jsonb_build_object('status', NEW.status);
    kept := kept || jsonb_build_object('status', OLD.status);
  END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    attempted := attempted || jsonb_build_object('is_verified', NEW.is_verified);
    kept := kept || jsonb_build_object('is_verified', OLD.is_verified);
  END IF;
  IF NEW.verified_manual IS DISTINCT FROM OLD.verified_manual THEN
    attempted := attempted || jsonb_build_object('verified_manual', NEW.verified_manual);
    kept := kept || jsonb_build_object('verified_manual', OLD.verified_manual);
  END IF;
  IF NEW.community_verified IS DISTINCT FROM OLD.community_verified THEN
    attempted := attempted || jsonb_build_object('community_verified', NEW.community_verified);
    kept := kept || jsonb_build_object('community_verified', OLD.community_verified);
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    attempted := attempted || jsonb_build_object('plan', NEW.plan);
    kept := kept || jsonb_build_object('plan', OLD.plan);
  END IF;
  IF NEW.featured IS DISTINCT FROM OLD.featured THEN
    attempted := attempted || jsonb_build_object('featured', NEW.featured);
    kept := kept || jsonb_build_object('featured', OLD.featured);
  END IF;

  NEW.status             := OLD.status;
  NEW.is_verified        := OLD.is_verified;
  NEW.verified_manual    := OLD.verified_manual;
  NEW.verified_by        := OLD.verified_by;
  NEW.community_verified := OLD.community_verified;
  NEW.plan               := OLD.plan;
  NEW.featured           := OLD.featured;

  PERFORM public.audit_privileged_revert('providers', OLD.id::text, OLD.user_id, attempted, kept);
  RETURN NEW;
END;
$$;

-- 4) sponsors — cobertura ampliada (ativação, plano, tier, selo, ordenação, tipo)
CREATE OR REPLACE FUNCTION public.guard_sponsor_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempted jsonb := '{}'::jsonb;
  kept jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    attempted := attempted || jsonb_build_object('status', NEW.status);
    kept := kept || jsonb_build_object('status', OLD.status);
  END IF;
  IF NEW.active IS DISTINCT FROM OLD.active THEN
    attempted := attempted || jsonb_build_object('active', NEW.active);
    kept := kept || jsonb_build_object('active', OLD.active);
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    attempted := attempted || jsonb_build_object('plan', NEW.plan);
    kept := kept || jsonb_build_object('plan', OLD.plan);
  END IF;
  IF NEW.plan_tier IS DISTINCT FROM OLD.plan_tier THEN
    attempted := attempted || jsonb_build_object('plan_tier', NEW.plan_tier);
    kept := kept || jsonb_build_object('plan_tier', OLD.plan_tier);
  END IF;
  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    attempted := attempted || jsonb_build_object('tier', NEW.tier);
    kept := kept || jsonb_build_object('tier', OLD.tier);
  END IF;
  IF NEW.badge_type IS DISTINCT FROM OLD.badge_type THEN
    attempted := attempted || jsonb_build_object('badge_type', NEW.badge_type);
    kept := kept || jsonb_build_object('badge_type', OLD.badge_type);
  END IF;

  NEW.status                 := OLD.status;
  NEW.active                 := OLD.active;
  NEW.approved_by            := OLD.approved_by;
  NEW.approved_at            := OLD.approved_at;
  NEW.rejected_by            := OLD.rejected_by;
  NEW.rejected_at            := OLD.rejected_at;
  NEW.rejection_reason       := OLD.rejection_reason;
  NEW.guaranteed_impressions := OLD.guaranteed_impressions;
  NEW.delivered_impressions  := OLD.delivered_impressions;
  NEW.plan                   := OLD.plan;
  NEW.plan_tier              := OLD.plan_tier;
  NEW.tier                   := OLD.tier;
  NEW.badge_type             := OLD.badge_type;
  NEW.display_order          := OLD.display_order;
  NEW.position               := OLD.position;
  NEW.sponsor_type           := OLD.sponsor_type;

  PERFORM public.audit_privileged_revert('sponsors', OLD.id::text, OLD.user_id, attempted, kept);
  RETURN NEW;
END;
$$;

-- 5) jobs — dono não altera aprovação nem contador de views
CREATE OR REPLACE FUNCTION public.guard_job_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempted jsonb := '{}'::jsonb;
  kept jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    attempted := attempted || jsonb_build_object('approval_status', NEW.approval_status);
    kept := kept || jsonb_build_object('approval_status', OLD.approval_status);
  END IF;

  NEW.approval_status := OLD.approval_status;
  NEW.view_count      := OLD.view_count;
  NEW.import_source_id := OLD.import_source_id;
  NEW.external_id     := OLD.external_id;

  PERFORM public.audit_privileged_revert('jobs', OLD.id::text, OLD.user_id, attempted, kept);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_a_guard_job_privileged ON public.jobs;
CREATE TRIGGER trg_a_guard_job_privileged
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.guard_job_privileged_columns();