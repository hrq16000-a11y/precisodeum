CREATE OR REPLACE FUNCTION public.log_provider_public_event(
  provider_id uuid,
  event_action text,
  page_path text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
BEGIN
  IF event_action NOT IN ('profile_view', 'whatsapp_click', 'phone_click') THEN
    RAISE EXCEPTION 'invalid event action';
  END IF;

  SELECT p.user_id INTO _owner_id
  FROM public.providers p
  WHERE p.id = provider_id
    AND p.status = 'approved'
    AND p.deleted_at IS NULL;

  IF _owner_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    _owner_id,
    event_action,
    'provider',
    provider_id::text,
    jsonb_build_object(
      'page_path', page_path,
      'source', 'public_profile',
      'visitor_authenticated', auth.uid() IS NOT NULL
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_provider_public_event(uuid, text, text) TO anon, authenticated;