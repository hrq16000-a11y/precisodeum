
-- === FIX 1: Bloqueia auto-escalação de privilégios em public.profiles ===
-- Trigger BEFORE UPDATE impede que o próprio usuário altere colunas sensíveis
-- (role, permissions, staff_role, account_type_id, commercial_plan, is_verified,
--  engagement_points). Admin e service_role continuam podendo alterar.
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
BEGIN
  BEGIN
    v_is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  IF v_is_service OR v_is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'not_authorized: cannot change role' USING ERRCODE = '42501';
  END IF;
  IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
    RAISE EXCEPTION 'not_authorized: cannot change permissions' USING ERRCODE = '42501';
  END IF;
  IF NEW.staff_role IS DISTINCT FROM OLD.staff_role THEN
    RAISE EXCEPTION 'not_authorized: cannot change staff_role' USING ERRCODE = '42501';
  END IF;
  IF NEW.account_type_id IS DISTINCT FROM OLD.account_type_id THEN
    RAISE EXCEPTION 'not_authorized: cannot change account_type_id' USING ERRCODE = '42501';
  END IF;
  IF NEW.commercial_plan IS DISTINCT FROM OLD.commercial_plan THEN
    RAISE EXCEPTION 'not_authorized: cannot change commercial_plan' USING ERRCODE = '42501';
  END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'not_authorized: cannot change is_verified' USING ERRCODE = '42501';
  END IF;
  IF NEW.engagement_points IS DISTINCT FROM OLD.engagement_points THEN
    RAISE EXCEPTION 'not_authorized: cannot change engagement_points' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- === FIX 2: Remove leitura de colunas sensíveis de sponsors por visitantes anônimos ===
-- Padrão idêntico ao aplicado em providers/agencies: RLS libera a linha, mas o
-- role 'anon' perde privilégio de SELECT nas colunas com PII (cnpj/email/phone/whatsapp).
REVOKE SELECT (cnpj, email, phone, whatsapp) ON public.sponsors FROM anon;

-- 'authenticated' mantém acesso pois donos precisam ver seus próprios dados
-- (a RLS 'Sponsor owners can view own sponsor' controla isso por linha).
