-- RPC: realinha service.service_name + service.category_id + provider.category_id
-- de forma transacional, garantindo a invariante "1º serviço = nome da categoria".
-- Usado pelo wizard quando reusa um service existente OU para auto-heal pós-criação.
CREATE OR REPLACE FUNCTION public.realign_first_service(
  _service_id uuid,
  _provider_id uuid,
  _category_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_user_id uuid := auth.uid();
  v_provider_user_id uuid;
  v_category_name text;
  v_service_provider_id uuid;
BEGIN
  IF v_caller_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  -- Verifica que o caller é dono do provider
  SELECT user_id INTO v_provider_user_id
  FROM public.providers
  WHERE id = _provider_id;

  IF v_provider_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'provider_not_found');
  END IF;

  IF v_provider_user_id <> v_caller_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- Verifica que o service pertence a esse provider
  SELECT provider_id INTO v_service_provider_id
  FROM public.services
  WHERE id = _service_id;

  IF v_service_provider_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'service_not_found');
  END IF;

  IF v_service_provider_id <> _provider_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'service_provider_mismatch');
  END IF;

  -- Resolve nome canônico da categoria
  SELECT name INTO v_category_name
  FROM public.categories
  WHERE id = _category_id;

  IF v_category_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'category_not_found');
  END IF;

  -- Realinha tudo na mesma transação (atômico — se um falhar, tudo reverte)
  UPDATE public.services
     SET service_name = v_category_name,
         category_id  = _category_id,
         updated_at   = now()
   WHERE id = _service_id;

  UPDATE public.providers
     SET category_id = _category_id,
         updated_at  = now()
   WHERE id = _provider_id;

  RETURN jsonb_build_object(
    'success', true,
    'service_id', _service_id,
    'provider_id', _provider_id,
    'category_id', _category_id,
    'category_name', v_category_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.realign_first_service(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realign_first_service(uuid, uuid, uuid) TO authenticated;