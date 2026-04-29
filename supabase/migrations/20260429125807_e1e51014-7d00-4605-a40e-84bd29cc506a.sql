-- Corrige RPC register_service_completion: usa colunas reais do audit_log
-- (user_id, action, resource_type, resource_id, details).
CREATE OR REPLACE FUNCTION public.register_service_completion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_provider_id uuid;
  v_boost_until timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT id INTO v_provider_id
  FROM public.providers
  WHERE user_id = auth.uid() AND deleted_at IS NULL
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'provider_not_found';
  END IF;

  v_boost_until := now() + interval '3 days';

  UPDATE public.providers
  SET
    last_active_at = now(),
    completion_boost_until = v_boost_until,
    updated_at = now()
  WHERE id = v_provider_id;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'service_completed',
    'provider',
    v_provider_id::text,
    jsonb_build_object('boost_until', v_boost_until)
  );

  RETURN jsonb_build_object(
    'success', true,
    'boost_until', v_boost_until,
    'boost_days', 3,
    'boost_multiplier', 1.15
  );
END;
$function$;