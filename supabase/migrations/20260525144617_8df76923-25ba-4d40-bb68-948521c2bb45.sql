-- 1) RPC log_web_vitals — batch JSONB, validação por item, rate-limit por flush
CREATE OR REPLACE FUNCTION public.log_web_vitals(
  _samples jsonb,
  _visitor_id text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_identifier text := coalesce(v_uid::text, _visitor_id, 'anon');
  v_rate_key text := 'log_web_vitals:' || v_identifier;
  v_recent_count int;
  v_inserted int := 0;
  v_item jsonb;
  v_metric text;
  v_value numeric;
  v_rating text;
  v_route text;
  v_max int;
  v_idx int := 0;
BEGIN
  IF _samples IS NULL OR jsonb_typeof(_samples) <> 'array' THEN
    RETURN 0;
  END IF;

  -- Rate-limit: 1 flush por minuto por identifier (reusa rate_limits)
  BEGIN
    SELECT count(*) INTO v_recent_count
      FROM public.rate_limits
     WHERE key = v_rate_key
       AND created_at > now() - interval '1 minute';
    IF v_recent_count > 0 THEN
      RETURN 0;
    END IF;
    INSERT INTO public.rate_limits (key) VALUES (v_rate_key);
  EXCEPTION WHEN undefined_table THEN
    -- Se rate_limits não existir, segue sem rate-limit em vez de quebrar
    NULL;
  END;

  v_max := least(jsonb_array_length(_samples), 10);

  WHILE v_idx < v_max LOOP
    v_item := _samples -> v_idx;
    v_idx := v_idx + 1;

    IF v_item IS NULL OR jsonb_typeof(v_item) <> 'object' THEN
      CONTINUE;
    END IF;

    v_metric := v_item ->> 'metric';
    v_route  := v_item ->> 'route';
    v_rating := v_item ->> 'rating';

    -- métrica obrigatória e dentro do enum do CHECK
    IF v_metric IS NULL OR v_metric NOT IN ('LCP','INP','CLS','FCP','TTFB') THEN
      CONTINUE;
    END IF;

    -- route obrigatório
    IF v_route IS NULL OR length(v_route) = 0 THEN
      CONTINUE;
    END IF;

    -- value numérico obrigatório
    BEGIN
      v_value := (v_item ->> 'value')::numeric;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;

    IF v_value IS NULL THEN CONTINUE; END IF;

    -- range por métrica
    IF v_metric = 'CLS' THEN
      IF v_value < 0 OR v_value > 10 THEN CONTINUE; END IF;
    ELSE
      IF v_value < 0 OR v_value > 60000 THEN CONTINUE; END IF;
    END IF;

    -- rating opcional; se inválido vira NULL
    IF v_rating IS NOT NULL AND v_rating NOT IN ('good','needs-improvement','poor') THEN
      v_rating := NULL;
    END IF;

    INSERT INTO public.web_vitals_log (
      route, metric, value, rating,
      navigation_type, connection_type,
      device_pixel_ratio, viewport, user_agent, user_id
    ) VALUES (
      left(v_route, 2000),
      v_metric,
      v_value,
      v_rating,
      left(nullif(v_item ->> 'navigation_type', ''), 500),
      left(nullif(v_item ->> 'connection_type', ''), 500),
      nullif(v_item ->> 'device_pixel_ratio', '')::numeric,
      left(nullif(v_item ->> 'viewport', ''), 500),
      left(nullif(v_item ->> 'user_agent', ''), 500),
      v_uid
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_web_vitals(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_web_vitals(jsonb, text) TO anon, authenticated;

-- 2) Lockdown
DROP POLICY IF EXISTS "anyone can insert web vitals" ON public.web_vitals_log;

REVOKE INSERT ON public.web_vitals_log FROM anon, authenticated;

CREATE POLICY "Deny direct inserts on web_vitals_log"
  ON public.web_vitals_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);
