-- Silencia ruído de log: usuários sem provider (clientes/visitantes que disparam recordMyGeoEvent)
-- não devem gerar ERROR no postgres_logs. Retornamos NULL silenciosamente.
CREATE OR REPLACE FUNCTION public.record_my_geo_event(
  _event_type text,
  _source text,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _neighborhood text DEFAULT NULL,
  _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL,
  _accuracy_m numeric DEFAULT NULL,
  _latency_ms numeric DEFAULT NULL,
  _status text DEFAULT 'logged',
  _error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_provider_id
  FROM public.providers
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Sem provider: retorna NULL silenciosamente (sem gerar ERROR no log).
  IF v_provider_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF _event_type NOT IN ('location_updated','gps_attempt','cep_resolved','manual_edit','ip_fallback') THEN
    RAISE EXCEPTION 'invalid_event_type' USING ERRCODE = '22023';
  END IF;
  IF _source NOT IN ('gps','cep','ip','manual','cache','unknown') THEN
    RAISE EXCEPTION 'invalid_source' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.provider_geo_audit(
    provider_id, actor_user_id, event_type, source, status,
    city, state, neighborhood, latitude, longitude,
    error_message, payload
  ) VALUES (
    v_provider_id, auth.uid(), _event_type, _source, COALESCE(_status, 'logged'),
    NULLIF(_city, ''), NULLIF(_state, ''), NULLIF(_neighborhood, ''),
    _latitude, _longitude,
    _error_message,
    jsonb_strip_nulls(jsonb_build_object(
      'accuracy_m', _accuracy_m,
      'latency_ms', _latency_ms
    ))
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;