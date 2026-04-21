CREATE OR REPLACE FUNCTION public.create_service_atomic(
  _provider_id uuid,
  _service_name text,
  _description text DEFAULT '',
  _whatsapp text DEFAULT '',
  _service_area text DEFAULT '',
  _address text DEFAULT '',
  _working_hours text DEFAULT '',
  _website text DEFAULT '',
  _instagram_url text DEFAULT '',
  _facebook_url text DEFAULT '',
  _youtube_url text DEFAULT '',
  _category_id uuid DEFAULT NULL,
  _category_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_provider record;
  v_service_id uuid;
  v_category_id uuid;
  v_error text;
  v_error_code text;
BEGIN
  SELECT id, user_id, user_ref, whatsapp, onboarding_progress
    INTO v_provider
    FROM public.providers
   WHERE id = _provider_id
     AND deleted_at IS NULL;

  IF v_provider.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'provider_not_found', 'provider_id', _provider_id, 'user_ref', NULL);
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> v_provider.user_id THEN
    INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (
      COALESCE(auth.uid(), v_provider.user_id),
      'service_save_failed',
      'service',
      NULL,
      jsonb_build_object(
        'provider_id', _provider_id,
        'user_ref', v_provider.user_ref,
        'reason', 'access_denied_or_rls',
        'attempted_user_id', auth.uid()
      )
    );
    RETURN jsonb_build_object('success', false, 'error', 'access_denied_or_rls', 'provider_id', _provider_id, 'user_ref', v_provider.user_ref);
  END IF;

  IF trim(COALESCE(_service_name, '')) = '' THEN
    INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (
      v_provider.user_id,
      'service_save_failed',
      'service',
      NULL,
      jsonb_build_object('provider_id', _provider_id, 'user_ref', v_provider.user_ref, 'reason', 'missing_service_name')
    );
    RETURN jsonb_build_object('success', false, 'error', 'missing_service_name', 'provider_id', _provider_id, 'user_ref', v_provider.user_ref);
  END IF;

  INSERT INTO public.services (
    provider_id, service_name, description, whatsapp, service_area, address,
    working_hours, website, instagram_url, facebook_url, youtube_url,
    category_id, user_ref
  )
  VALUES (
    _provider_id, trim(_service_name), COALESCE(_description, ''),
    COALESCE(NULLIF(_whatsapp, ''), v_provider.whatsapp, ''), COALESCE(_service_area, ''), COALESCE(_address, ''),
    COALESCE(_working_hours, ''), COALESCE(_website, ''), COALESCE(_instagram_url, ''), COALESCE(_facebook_url, ''), COALESCE(_youtube_url, ''),
    _category_id, v_provider.user_ref
  )
  RETURNING id INTO v_service_id;

  IF _category_id IS NOT NULL THEN
    INSERT INTO public.service_categories (service_id, category_id)
    VALUES (v_service_id, _category_id)
    ON CONFLICT DO NOTHING;
  END IF;

  FOREACH v_category_id IN ARRAY COALESCE(_category_ids, ARRAY[]::uuid[]) LOOP
    IF v_category_id IS NOT NULL THEN
      INSERT INTO public.service_categories (service_id, category_id)
      VALUES (v_service_id, v_category_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  UPDATE public.providers
     SET onboarding_progress = COALESCE(v_provider.onboarding_progress, '{}'::jsonb) || jsonb_build_object('services', true)
   WHERE id = _provider_id;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    v_provider.user_id,
    'service_save_success',
    'service',
    v_service_id::text,
    jsonb_build_object('provider_id', _provider_id, 'user_ref', v_provider.user_ref, 'category_id', _category_id)
  );

  RETURN jsonb_build_object('success', true, 'service_id', v_service_id, 'provider_id', _provider_id, 'user_ref', v_provider.user_ref);
EXCEPTION WHEN OTHERS THEN
  v_error := SQLERRM;
  v_error_code := SQLSTATE;
  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    COALESCE(auth.uid(), v_provider.user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    'service_save_failed',
    'service',
    NULL,
    jsonb_build_object(
      'provider_id', _provider_id,
      'user_ref', v_provider.user_ref,
      'reason', v_error,
      'sqlstate', v_error_code,
      'category_id', _category_id
    )
  );
  RETURN jsonb_build_object('success', false, 'error', v_error, 'sqlstate', v_error_code, 'provider_id', _provider_id, 'user_ref', v_provider.user_ref);
END;
$$;