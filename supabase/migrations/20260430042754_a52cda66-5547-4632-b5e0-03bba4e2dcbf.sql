-- 1) RPC: lista histórico de origem da localização do próprio prestador.
--    O dono já pode ler `provider_geo_audit` (RLS existente), mas a RPC encapsula
--    a query, ordena, limita e devolve um shape estável para o dashboard.
CREATE OR REPLACE FUNCTION public.list_my_geo_audit(_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  event_type text,
  source text,
  status text,
  city text,
  state text,
  neighborhood text,
  latitude numeric,
  longitude numeric,
  accuracy_m numeric,
  latency_ms numeric,
  error_message text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.event_type,
    a.source,
    a.status,
    a.city,
    a.state,
    a.neighborhood,
    a.latitude,
    a.longitude,
    NULLIF((a.payload->>'accuracy_m')::numeric, NULL) AS accuracy_m,
    NULLIF((a.payload->>'latency_ms')::numeric, NULL) AS latency_ms,
    a.error_message,
    a.created_at
  FROM public.provider_geo_audit a
  JOIN public.providers p ON p.id = a.provider_id
  WHERE p.user_id = auth.uid()
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 50), 200));
$$;

REVOKE ALL ON FUNCTION public.list_my_geo_audit(int) FROM public;
GRANT EXECUTE ON FUNCTION public.list_my_geo_audit(int) TO authenticated;

-- 2) RPC: registra um evento de localização para o provider do usuário logado.
--    Chamada do client após GPS/CEP/manual confirmar uma origem nova. Owner-safe.
CREATE OR REPLACE FUNCTION public.record_my_geo_event(
  _event_type text,
  _source text,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _neighborhood text DEFAULT NULL,
  _latitude numeric DEFAULT NULL,
  _longitude numeric DEFAULT NULL,
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
  -- Resolve provider do usuário logado (apenas o próprio).
  SELECT id INTO v_provider_id
  FROM public.providers
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'no_provider_for_user' USING ERRCODE = '42501';
  END IF;

  -- Whitelist de event_type / source — proteção contra payload arbitrário.
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

REVOKE ALL ON FUNCTION public.record_my_geo_event(text,text,text,text,text,numeric,numeric,numeric,numeric,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_my_geo_event(text,text,text,text,text,numeric,numeric,numeric,numeric,text,text) TO authenticated;

COMMENT ON FUNCTION public.list_my_geo_audit(int) IS
  'Histórico de origem da localização do prestador logado (GPS/CEP/IP/manual). Usado em /dashboard/cadastro-status.';
COMMENT ON FUNCTION public.record_my_geo_event IS
  'Registra um evento de mudança de origem da localização do prestador logado. event_type ∈ {location_updated,gps_attempt,cep_resolved,manual_edit,ip_fallback}; source ∈ {gps,cep,ip,manual,cache,unknown}.';