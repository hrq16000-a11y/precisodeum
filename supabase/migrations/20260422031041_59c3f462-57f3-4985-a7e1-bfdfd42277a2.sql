CREATE OR REPLACE FUNCTION public.update_site_setting_audited(p_key text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_old_value text;
BEGIN
  IF v_user_id IS NULL OR NOT public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin privileges required';
  END IF;

  SELECT value
    INTO v_old_value
    FROM public.site_settings
   WHERE key = p_key
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'site setting not found: %', p_key;
  END IF;

  UPDATE public.site_settings
     SET value = p_value,
         updated_at = now()
   WHERE key = p_key;

  INSERT INTO public.audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    v_user_id,
    'setting_updated',
    'site_setting',
    p_key,
    jsonb_build_object(
      'old_value', v_old_value,
      'new_value', p_value
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_site_setting_audited(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_site_setting_audited(text, text) TO authenticated;