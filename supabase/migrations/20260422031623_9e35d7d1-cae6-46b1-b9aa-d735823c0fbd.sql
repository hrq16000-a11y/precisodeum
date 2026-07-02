CREATE OR REPLACE FUNCTION public.update_service_atomic(
  p_service_id uuid,
  p_data jsonb,
  p_category_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_service record;
  v_category_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar logado para atualizar serviços.';
  END IF;

  SELECT s.id, s.provider_id, s.user_ref, p.user_id AS provider_user_id, p.user_ref AS provider_user_ref
    INTO v_service
    FROM public.services s
    JOIN public.providers p ON p.id = s.provider_id
   WHERE s.id = p_service_id
   FOR UPDATE OF s;

  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'Serviço não encontrado.';
  END IF;

  IF v_service.provider_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Este serviço pertence a outro profissional.';
  END IF;

  UPDATE public.services
     SET service_name = COALESCE(NULLIF(trim(p_data->>'service_name'), ''), service_name),
         description = COALESCE(p_data->>'description', description),
         price = CASE WHEN p_data ? 'price' THEN NULLIF(p_data->>'price', '') ELSE price END,
         whatsapp = COALESCE(p_data->>'whatsapp', whatsapp),
         service_area = COALESCE(p_data->>'service_area', service_area),
         address = COALESCE(p_data->>'address', address),
         working_hours = COALESCE(p_data->>'working_hours', working_hours),
         website = COALESCE(p_data->>'website', website),
         instagram_url = COALESCE(p_data->>'instagram_url', instagram_url),
         facebook_url = COALESCE(p_data->>'facebook_url', facebook_url),
         youtube_url = COALESCE(p_data->>'youtube_url', youtube_url),
         is_emergency = CASE WHEN p_data ? 'is_emergency' THEN (p_data->>'is_emergency')::boolean ELSE is_emergency END,
         service_radius = COALESCE(p_data->>'service_radius', service_radius),
         seo_tags = CASE
           WHEN p_data ? 'seo_tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_data->'seo_tags'))
           ELSE seo_tags
         END,
         category_id = CASE
           WHEN p_data ? 'category_id' AND NULLIF(p_data->>'category_id', '') IS NOT NULL THEN (p_data->>'category_id')::uuid
           WHEN p_data ? 'category_id' THEN NULL
           ELSE category_id
         END,
         deleted_at = CASE
           WHEN p_data ? 'deleted_at' AND NULLIF(p_data->>'deleted_at', '') IS NOT NULL THEN (p_data->>'deleted_at')::timestamptz
           WHEN p_data ? 'deleted_at' THEN NULL
           ELSE deleted_at
         END,
         updated_at = now()
   WHERE id = p_service_id;

  IF p_category_ids IS NOT NULL THEN
    DELETE FROM public.service_categories WHERE service_id = p_service_id;
    FOREACH v_category_id IN ARRAY p_category_ids LOOP
      IF v_category_id IS NOT NULL THEN
        INSERT INTO public.service_categories (service_id, category_id)
        VALUES (p_service_id, v_category_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    v_user_id,
    'service_update_success',
    'service',
    p_service_id::text,
    jsonb_build_object(
      'provider_id', v_service.provider_id,
      'user_ref', COALESCE(v_service.user_ref, v_service.provider_user_ref),
      'changed_fields', (SELECT jsonb_agg(key) FROM jsonb_object_keys(p_data) AS key)
    )
  );

  RETURN jsonb_build_object('success', true, 'service_id', p_service_id, 'provider_id', v_service.provider_id, 'user_ref', COALESCE(v_service.user_ref, v_service.provider_user_ref));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_service_atomic(uuid, jsonb, uuid[]) TO authenticated;