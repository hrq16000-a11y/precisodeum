-- 2) Colunas em profiles: staff_role + commercial_plan
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_role public.app_role,
  ADD COLUMN IF NOT EXISTS commercial_plan text
    CHECK (commercial_plan IN ('gratuito','prospeccao','corporativo'));

UPDATE public.profiles SET commercial_plan = 'gratuito' WHERE commercial_plan IS NULL;
ALTER TABLE public.profiles ALTER COLUMN commercial_plan SET DEFAULT 'gratuito';

CREATE INDEX IF NOT EXISTS idx_profiles_staff_role ON public.profiles(staff_role) WHERE staff_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_commercial_plan ON public.profiles(commercial_plan);

-- 3) Tabela staff_permissions (matriz cargo x permissão)
CREATE TABLE IF NOT EXISTS public.staff_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, permission_key)
);

ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage staff_permissions"
ON public.staff_permissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated read staff_permissions"
ON public.staff_permissions FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER staff_permissions_updated_at
BEFORE UPDATE ON public.staff_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seeds: chaves padrão (Financeiro, Leads, Aprovação, Conteúdo, Sistema, Usuários)
INSERT INTO public.staff_permissions (role, permission_key, enabled, description) VALUES
  ('gerente','view_finance',     true,  'Ver módulo financeiro'),
  ('gerente','view_leads',       true,  'Ver leads'),
  ('gerente','approve_providers',true,  'Aprovar prestadores'),
  ('gerente','manage_content',   true,  'Gerenciar conteúdo'),
  ('gerente','manage_system',    false, 'Configurações de sistema'),
  ('gerente','edit_users',       true,  'Editar usuários'),
  ('supervisor','view_finance',     false,'Ver módulo financeiro'),
  ('supervisor','view_leads',       true, 'Ver leads'),
  ('supervisor','approve_providers',true, 'Aprovar prestadores'),
  ('supervisor','manage_content',   true, 'Gerenciar conteúdo'),
  ('supervisor','manage_system',    false,'Configurações de sistema'),
  ('supervisor','edit_users',       true, 'Editar usuários'),
  ('analista','view_finance',     false,'Ver módulo financeiro'),
  ('analista','view_leads',       true, 'Ver leads'),
  ('analista','approve_providers',false,'Aprovar prestadores'),
  ('analista','manage_content',   false,'Gerenciar conteúdo'),
  ('analista','manage_system',    false,'Configurações de sistema'),
  ('analista','edit_users',       false,'Editar usuários')
ON CONFLICT (role, permission_key) DO NOTHING;

-- 4) Tabela system_audit_logs (registro imutável)
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  target_user_id uuid,
  old_values jsonb,
  new_values jsonb,
  context_metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sys_audit_target ON public.system_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_staff ON public.system_audit_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_action ON public.system_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_sys_audit_created ON public.system_audit_logs(created_at DESC);

ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read system_audit_logs"
ON public.system_audit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated insert system_audit_logs"
ON public.system_audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND staff_id = auth.uid());

-- 5) Helper: auth.uid é admin?
CREATE OR REPLACE FUNCTION public.is_caller_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.has_role(auth.uid(), 'admin'::public.app_role); $$;

-- 6) Trigger: somente admin pode alterar staff_role de profiles
CREATE OR REPLACE FUNCTION public.guard_staff_role_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.staff_role IS DISTINCT FROM OLD.staff_role THEN
    IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only admins can change staff_role';
    END IF;
    INSERT INTO public.system_audit_logs (staff_id, action, entity_type, entity_id, target_user_id, old_values, new_values)
    VALUES (auth.uid(), 'staff_role_changed', 'profile', NEW.id::text, NEW.id,
            jsonb_build_object('staff_role', OLD.staff_role),
            jsonb_build_object('staff_role', NEW.staff_role));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_staff_role ON public.profiles;
CREATE TRIGGER guard_staff_role
BEFORE UPDATE OF staff_role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_staff_role_update();

-- 7) RPC: helper p/ buscar permissões efetivas
CREATE OR REPLACE FUNCTION public.get_staff_permissions(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_role public.app_role;
  v_perms jsonb;
  v_is_admin boolean;
BEGIN
  v_is_admin := public.has_role(_user_id, 'admin'::public.app_role);
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'role','admin',
      'view_finance',true,'view_leads',true,'approve_providers',true,
      'manage_content',true,'manage_system',true,'edit_users',true
    );
  END IF;

  SELECT staff_role INTO v_role FROM public.profiles WHERE id = _user_id;
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('role', null);
  END IF;

  SELECT jsonb_object_agg(permission_key, enabled) INTO v_perms
  FROM public.staff_permissions WHERE role = v_role;

  RETURN COALESCE(v_perms, '{}'::jsonb) || jsonb_build_object('role', v_role::text);
END;
$$;