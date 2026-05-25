-- A2: Restringir leitura de staff_permissions apenas para admins
-- Removendo policy permissiva que expunha o RBAC completo para qualquer authenticated
DROP POLICY IF EXISTS "Authenticated read staff_permissions" ON public.staff_permissions;

-- Policy SELECT restrita a admins
-- (a policy "Admins manage staff_permissions" FOR ALL já cobre, mas mantemos explícita
--  para clareza/auditoria)
CREATE POLICY "Admins read staff_permissions"
  ON public.staff_permissions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Usuários comuns continuam consultando suas próprias permissões via RPC
-- public.get_staff_permissions(_user_id uuid) que é SECURITY DEFINER e bypassa RLS.