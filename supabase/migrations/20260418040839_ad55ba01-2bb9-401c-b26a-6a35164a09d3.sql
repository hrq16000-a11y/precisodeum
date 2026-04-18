-- RPC: admin updates staff role permission toggle
CREATE OR REPLACE FUNCTION public.admin_set_staff_permission(
  _role app_role,
  _permission_key text,
  _enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF _role NOT IN ('gerente'::app_role, 'supervisor'::app_role, 'analista'::app_role) THEN
    RAISE EXCEPTION 'Cargo inválido: apenas gerente, supervisor ou analista';
  END IF;

  SELECT enabled INTO v_old FROM public.staff_permissions
  WHERE role = _role AND permission_key = _permission_key;

  INSERT INTO public.staff_permissions (role, permission_key, enabled)
  VALUES (_role, _permission_key, _enabled)
  ON CONFLICT (role, permission_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    updated_at = now();

  INSERT INTO public.system_audit_logs (staff_id, action, target_user_id, old_values, new_values)
  VALUES (
    auth.uid(),
    'staff_permission_toggled',
    NULL,
    jsonb_build_object('role', _role::text, 'permission_key', _permission_key, 'enabled', v_old),
    jsonb_build_object('role', _role::text, 'permission_key', _permission_key, 'enabled', _enabled)
  );
END;
$$;

-- RPC: admin export audit logs as JSON (frontend converts to CSV)
CREATE OR REPLACE FUNCTION public.admin_export_audit_logs(_days integer DEFAULT 30)
RETURNS TABLE(
  id uuid,
  staff_id uuid,
  staff_email text,
  action text,
  target_user_id uuid,
  target_email text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.staff_id,
    sp.email AS staff_email,
    l.action,
    l.target_user_id,
    tp.email AS target_email,
    l.old_values,
    l.new_values,
    l.created_at
  FROM public.system_audit_logs l
  LEFT JOIN public.profiles sp ON sp.id = l.staff_id
  LEFT JOIN public.profiles tp ON tp.id = l.target_user_id
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
    AND l.created_at >= now() - (_days || ' days')::interval
  ORDER BY l.created_at DESC;
$$;