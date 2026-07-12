
-- =========================================================
-- 1) Auditoria de alterações privilegiadas em public.profiles
-- =========================================================
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
  v_is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                       OR (current_user = 'service_role')
                       OR (current_user = 'postgres');
  v_actor uuid := auth.uid();
  v_changed text[] := ARRAY[]::text[];
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    v_changed := array_append(v_changed, 'role');
    v_old := v_old || jsonb_build_object('role', OLD.role::text);
    v_new := v_new || jsonb_build_object('role', NEW.role::text);
  END IF;
  IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
    v_changed := array_append(v_changed, 'permissions');
    v_old := v_old || jsonb_build_object('permissions', OLD.permissions);
    v_new := v_new || jsonb_build_object('permissions', NEW.permissions);
  END IF;
  IF NEW.staff_role IS DISTINCT FROM OLD.staff_role THEN
    v_changed := array_append(v_changed, 'staff_role');
    v_old := v_old || jsonb_build_object('staff_role', OLD.staff_role::text);
    v_new := v_new || jsonb_build_object('staff_role', NEW.staff_role::text);
  END IF;
  IF NEW.account_type_id IS DISTINCT FROM OLD.account_type_id THEN
    v_changed := array_append(v_changed, 'account_type_id');
    v_old := v_old || jsonb_build_object('account_type_id', OLD.account_type_id::text);
    v_new := v_new || jsonb_build_object('account_type_id', NEW.account_type_id::text);
  END IF;
  IF NEW.commercial_plan IS DISTINCT FROM OLD.commercial_plan THEN
    v_changed := array_append(v_changed, 'commercial_plan');
    v_old := v_old || jsonb_build_object('commercial_plan', OLD.commercial_plan::text);
    v_new := v_new || jsonb_build_object('commercial_plan', NEW.commercial_plan::text);
  END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    v_changed := array_append(v_changed, 'is_verified');
    v_old := v_old || jsonb_build_object('is_verified', OLD.is_verified);
    v_new := v_new || jsonb_build_object('is_verified', NEW.is_verified);
  END IF;
  IF NEW.engagement_points IS DISTINCT FROM OLD.engagement_points THEN
    v_changed := array_append(v_changed, 'engagement_points');
    v_old := v_old || jsonb_build_object('engagement_points', OLD.engagement_points);
    v_new := v_new || jsonb_build_object('engagement_points', NEW.engagement_points);
  END IF;

  BEGIN
    v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  -- Caminho autorizado (admin/service_role): registra alteração legítima e segue.
  IF v_is_service OR v_is_admin THEN
    IF array_length(v_changed, 1) IS NOT NULL THEN
      BEGIN
        INSERT INTO public.system_audit_logs(
          staff_id, action, entity_type, entity_id, target_user_id,
          old_values, new_values, context_metadata
        ) VALUES (
          v_actor, 'profile_privileged_update', 'profiles', NEW.id::text, NEW.id,
          v_old, v_new,
          jsonb_build_object(
            'source', CASE WHEN v_is_service THEN 'service_role' ELSE 'admin' END,
            'changed_columns', v_changed
          )
        );
      EXCEPTION WHEN OTHERS THEN
        NULL; -- auditoria nunca deve quebrar a mutação legítima
      END;
    END IF;
    RETURN NEW;
  END IF;

  -- Caminho bloqueado (usuário comum): registra tentativa e nega.
  IF array_length(v_changed, 1) IS NOT NULL THEN
    BEGIN
      INSERT INTO public.system_audit_logs(
        staff_id, action, entity_type, entity_id, target_user_id,
        old_values, new_values, context_metadata
      ) VALUES (
        v_actor, 'profile_privileged_update_blocked', 'profiles', NEW.id::text, NEW.id,
        v_old, v_new,
        jsonb_build_object('source', 'user_self_update', 'blocked', true, 'changed_columns', v_changed)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RAISE EXCEPTION 'not_authorized: cannot change privileged profile columns' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- =========================================================
-- 2) Defesa em profundidade — remove privilégios residuais do anon
-- =========================================================
REVOKE INSERT, UPDATE, DELETE, SELECT ON public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.sponsors FROM anon;

-- =========================================================
-- 3) Trilha de auditoria de acesso a PII de patrocinadores
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sponsor_pii_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL,
  accessed_by uuid,
  accessed_columns text[] NOT NULL DEFAULT ARRAY[]::text[],
  reason text,
  source text NOT NULL DEFAULT 'admin_panel',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sponsor_pii_access_log TO authenticated;
GRANT ALL ON public.sponsor_pii_access_log TO service_role;

ALTER TABLE public.sponsor_pii_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read sponsor PII access log" ON public.sponsor_pii_access_log;
CREATE POLICY "Admins can read sponsor PII access log"
ON public.sponsor_pii_access_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "No direct insert into sponsor PII access log" ON public.sponsor_pii_access_log;
CREATE POLICY "No direct insert into sponsor PII access log"
ON public.sponsor_pii_access_log FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_sponsor_pii_access_log_sponsor_id
  ON public.sponsor_pii_access_log(sponsor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sponsor_pii_access_log_actor
  ON public.sponsor_pii_access_log(accessed_by, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_sponsor_pii_access(
  _sponsor_id uuid,
  _accessed_columns text[] DEFAULT ARRAY[]::text[],
  _reason text DEFAULT NULL,
  _source text DEFAULT 'admin_panel'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  IF _sponsor_id IS NULL THEN
    RAISE EXCEPTION 'sponsor_id required' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_is_admin := public.has_role(v_actor, 'admin'::public.app_role);
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  -- Somente admin ou dono do sponsor pode registrar acesso (evita spam anon).
  IF NOT v_is_admin AND NOT EXISTS (
    SELECT 1 FROM public.sponsors s WHERE s.id = _sponsor_id AND s.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.sponsor_pii_access_log(
    sponsor_id, accessed_by, accessed_columns, reason, source
  ) VALUES (
    _sponsor_id, v_actor,
    COALESCE(_accessed_columns, ARRAY[]::text[]),
    NULLIF(trim(_reason), ''),
    COALESCE(NULLIF(trim(_source), ''), 'admin_panel')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_sponsor_pii_access(uuid, text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_sponsor_pii_access(uuid, text[], text, text) TO authenticated, service_role;
