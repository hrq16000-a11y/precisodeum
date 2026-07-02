CREATE OR REPLACE FUNCTION public.publish_my_provider()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_provider RECORD;
  v_profile RECORD;
  v_services int;
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = v_user LIMIT 1;
  SELECT * INTO v_provider FROM providers WHERE user_id = v_user LIMIT 1;

  IF v_provider.id IS NULL THEN
    RAISE EXCEPTION 'provider_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Validações mínimas para publicar
  IF v_profile.full_name IS NULL OR length(btrim(v_profile.full_name)) < 3 OR position(' ' in btrim(v_profile.full_name)) = 0 THEN
    v_missing := array_append(v_missing, 'name');
  END IF;
  IF v_profile.whatsapp IS NULL OR length(regexp_replace(v_profile.whatsapp, '\D', '', 'g')) < 10 THEN
    v_missing := array_append(v_missing, 'whatsapp');
  END IF;
  IF v_profile.city IS NULL OR v_profile.state IS NULL OR length(btrim(v_profile.state)) <> 2 THEN
    v_missing := array_append(v_missing, 'location');
  END IF;

  SELECT count(*) INTO v_services
    FROM services
   WHERE provider_id = v_provider.id
     AND deleted_at IS NULL;
  IF v_services < 1 THEN
    v_missing := array_append(v_missing, 'service');
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'missing_required',
      'missing', to_jsonb(v_missing),
      'status', v_provider.status
    );
  END IF;

  -- Já publicado
  IF v_provider.status IN ('approved', 'active') THEN
    RETURN jsonb_build_object('ok', true, 'status', v_provider.status, 'already', true);
  END IF;

  UPDATE providers
     SET status = 'approved',
         updated_at = now()
   WHERE id = v_provider.id;

  RETURN jsonb_build_object('ok', true, 'status', 'approved', 'already', false);
END;
$$;

REVOKE ALL ON FUNCTION public.publish_my_provider() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_my_provider() TO authenticated;