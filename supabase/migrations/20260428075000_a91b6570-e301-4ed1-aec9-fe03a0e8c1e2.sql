ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS geo_source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS geo_source_confidence numeric,
  ADD COLUMN IF NOT EXISTS geo_source_updated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS geo_source_notes jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'providers_geo_source_check'
      AND conrelid = 'public.providers'::regclass
  ) THEN
    ALTER TABLE public.providers
      ADD CONSTRAINT providers_geo_source_check
      CHECK (geo_source IN ('unknown','gps','city_center','address_geocode','gps_plus_city_center','gps_plus_address_geocode'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.provider_geo_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  actor_user_id uuid,
  event_type text NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'logged',
  city text,
  state text,
  neighborhood text,
  latitude numeric,
  longitude numeric,
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_geo_audit ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_provider_geo_audit_provider_created
  ON public.provider_geo_audit (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_geo_audit_status_created
  ON public.provider_geo_audit (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_geo_audit_source_created
  ON public.provider_geo_audit (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_geo_audit_event_created
  ON public.provider_geo_audit (event_type, created_at DESC);

DROP POLICY IF EXISTS "Admins can view provider geo audit" ON public.provider_geo_audit;
CREATE POLICY "Admins can view provider geo audit"
ON public.provider_geo_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage provider geo audit" ON public.provider_geo_audit;
CREATE POLICY "Admins can manage provider geo audit"
ON public.provider_geo_audit
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owners can view own provider geo audit" ON public.provider_geo_audit;
CREATE POLICY "Owners can view own provider geo audit"
ON public.provider_geo_audit
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.providers p
    WHERE p.id = provider_geo_audit.provider_id
      AND p.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.set_provider_geo_source(
  _provider_id uuid,
  _source text,
  _confidence numeric DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb,
  _event_type text DEFAULT 'source_updated',
  _status text DEFAULT 'logged',
  _error_message text DEFAULT NULL,
  _actor_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider public.providers%ROWTYPE;
  v_source text;
BEGIN
  SELECT * INTO v_provider
  FROM public.providers
  WHERE id = _provider_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_source := COALESCE(NULLIF(trim(_source), ''), 'unknown');

  UPDATE public.providers
  SET geo_source = v_source,
      geo_source_confidence = _confidence,
      geo_source_updated_at = now(),
      geo_source_notes = COALESCE(geo_source_notes, '{}'::jsonb) || COALESCE(_payload, '{}'::jsonb)
  WHERE id = _provider_id;

  INSERT INTO public.provider_geo_audit (
    provider_id,
    actor_user_id,
    event_type,
    source,
    status,
    city,
    state,
    neighborhood,
    latitude,
    longitude,
    error_message,
    payload
  ) VALUES (
    _provider_id,
    _actor_user_id,
    COALESCE(NULLIF(trim(_event_type), ''), 'source_updated'),
    v_source,
    COALESCE(NULLIF(trim(_status), ''), 'logged'),
    v_provider.city,
    v_provider.state,
    v_provider.neighborhood,
    v_provider.latitude,
    v_provider.longitude,
    _error_message,
    COALESCE(_payload, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_provider_geo_issue(
  _provider_id uuid,
  _event_type text,
  _source text DEFAULT 'unknown',
  _status text DEFAULT 'error',
  _error_message text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb,
  _actor_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider public.providers%ROWTYPE;
  v_source text;
BEGIN
  SELECT * INTO v_provider
  FROM public.providers
  WHERE id = _provider_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_source := COALESCE(NULLIF(trim(_source), ''), COALESCE(v_provider.geo_source, 'unknown'));

  INSERT INTO public.provider_geo_audit (
    provider_id,
    actor_user_id,
    event_type,
    source,
    status,
    city,
    state,
    neighborhood,
    latitude,
    longitude,
    error_message,
    payload
  ) VALUES (
    _provider_id,
    _actor_user_id,
    COALESCE(NULLIF(trim(_event_type), ''), 'issue'),
    v_source,
    COALESCE(NULLIF(trim(_status), ''), 'error'),
    v_provider.city,
    v_provider.state,
    v_provider.neighborhood,
    v_provider.latitude,
    v_provider.longitude,
    _error_message,
    COALESCE(_payload, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_provider_geo_reviewed(
  _audit_id uuid,
  _status text,
  _review_notes text DEFAULT NULL,
  _provider_lat numeric DEFAULT NULL,
  _provider_lng numeric DEFAULT NULL,
  _source text DEFAULT NULL
)
RETURNS public.provider_geo_audit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.provider_geo_audit%ROWTYPE;
  v_provider_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas admins podem revisar geocoding';
  END IF;

  UPDATE public.provider_geo_audit
  SET status = COALESCE(NULLIF(trim(_status), ''), status),
      review_notes = COALESCE(_review_notes, review_notes),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = _audit_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento de geocoding não encontrado';
  END IF;

  v_provider_id := v_row.provider_id;

  IF _provider_lat IS NOT NULL AND _provider_lng IS NOT NULL THEN
    UPDATE public.providers
    SET latitude = _provider_lat,
        longitude = _provider_lng,
        geo_source = COALESCE(NULLIF(trim(_source), ''), geo_source),
        geo_source_updated_at = now(),
        geo_source_notes = COALESCE(geo_source_notes, '{}'::jsonb) || jsonb_build_object(
          'reviewed_at', now(),
          'reviewed_by', auth.uid(),
          'review_notes', _review_notes
        )
    WHERE id = v_provider_id;
  END IF;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'review_geo_audit',
    'provider_geo_audit',
    _audit_id::text,
    jsonb_build_object(
      'provider_id', v_provider_id,
      'status', COALESCE(NULLIF(trim(_status), ''), v_row.status),
      'review_notes', _review_notes,
      'source', COALESCE(NULLIF(trim(_source), ''), v_row.source)
    )
  );

  SELECT * INTO v_row FROM public.provider_geo_audit WHERE id = _audit_id;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_provider_geo_fallbacks(
  _status text DEFAULT NULL,
  _limit integer DEFAULT 200
)
RETURNS TABLE (
  audit_id uuid,
  provider_id uuid,
  provider_name text,
  city text,
  state text,
  neighborhood text,
  status text,
  source text,
  event_type text,
  created_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  error_message text,
  latitude numeric,
  longitude numeric,
  payload jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS audit_id,
    p.id AS provider_id,
    COALESCE(NULLIF(trim(pr.full_name), ''), NULLIF(trim(p.business_name), ''), 'Profissional') AS provider_name,
    a.city,
    a.state,
    a.neighborhood,
    a.status,
    a.source,
    a.event_type,
    a.created_at,
    a.reviewed_at,
    a.error_message,
    a.latitude,
    a.longitude,
    a.payload
  FROM public.provider_geo_audit a
  JOIN public.providers p ON p.id = a.provider_id
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE public.has_role(auth.uid(), 'admin')
    AND a.source IN ('city_center', 'gps_plus_city_center')
    AND (_status IS NULL OR a.status = _status)
  ORDER BY a.created_at DESC
  LIMIT GREATEST(COALESCE(_limit, 200), 1);
$$;

CREATE OR REPLACE FUNCTION public.notify_admins_geo_alert(
  _title text,
  _message text,
  _link text DEFAULT '/admin/prestadores?tab=geo-fallback',
  _type text DEFAULT 'geo_alert'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT ur.user_id, _title, _message, COALESCE(NULLIF(trim(_type), ''), 'geo_alert'), _link
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = ur.user_id
        AND n.type = COALESCE(NULLIF(trim(_type), ''), 'geo_alert')
        AND n.title = _title
        AND n.created_at > now() - interval '6 hours'
    );
END;
$$;

INSERT INTO public.site_settings (key, label, value, description, is_public)
VALUES
  ('geo_alert_failure_threshold', 'Limite de falhas de geocoding', '5', 'Quantidade de falhas de geocoding no período antes de alertar admins.', false),
  ('geo_alert_window_minutes', 'Janela de alerta de geocoding', '60', 'Janela em minutos usada para avaliar alertas de falhas de geocoding.', false)
ON CONFLICT (key) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    is_public = EXCLUDED.is_public;

CREATE OR REPLACE FUNCTION public.check_geo_alert_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold integer := 5;
  v_window integer := 60;
  v_failures integer := 0;
BEGIN
  IF NEW.status NOT IN ('error', 'warning') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(value::integer, 5) INTO v_threshold
  FROM public.site_settings
  WHERE key = 'geo_alert_failure_threshold';

  SELECT COALESCE(value::integer, 60) INTO v_window
  FROM public.site_settings
  WHERE key = 'geo_alert_window_minutes';

  SELECT count(*) INTO v_failures
  FROM public.provider_geo_audit
  WHERE created_at >= now() - make_interval(mins => GREATEST(v_window, 1))
    AND status IN ('error', 'warning');

  IF v_failures >= GREATEST(v_threshold, 1) THEN
    PERFORM public.notify_admins_geo_alert(
      'Atenção: falhas de geocoding acima do limite',
      format('Foram detectadas %s falhas de geocoding nos últimos %s minutos. Revise os providers com fallback e erros de localização.', v_failures, v_window)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_geo_alert_threshold ON public.provider_geo_audit;
CREATE TRIGGER trg_check_geo_alert_threshold
AFTER INSERT ON public.provider_geo_audit
FOR EACH ROW
EXECUTE FUNCTION public.check_geo_alert_threshold();

CREATE OR REPLACE FUNCTION public.fill_provider_coords_from_city()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
  v_city_norm text;
  v_prev_source text;
BEGIN
  v_prev_source := COALESCE(NEW.geo_source, OLD.geo_source, 'unknown');

  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.geo_source := CASE WHEN v_prev_source IN ('unknown', 'city_center') THEN 'gps' ELSE v_prev_source END;
      NEW.geo_source_updated_at := COALESCE(NEW.geo_source_updated_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.city IS NULL OR length(trim(NEW.city)) = 0 THEN
    RETURN NEW;
  END IF;

  v_city_norm := public._strip_accents(NEW.city);

  SELECT c.latitude, c.longitude
    INTO v_lat, v_lng
    FROM public.cities c
   WHERE public._strip_accents(c.name) = v_city_norm
     AND (NEW.state IS NULL OR c.state = NEW.state OR c.state_uf = NEW.state)
     AND c.latitude IS NOT NULL
     AND c.longitude IS NOT NULL
   ORDER BY (c.state = NEW.state) DESC NULLS LAST,
            COALESCE(c.provider_count, 0) DESC
   LIMIT 1;

  IF v_lat IS NULL THEN
    SELECT c.latitude, c.longitude
      INTO v_lat, v_lng
      FROM public.cities c
     WHERE (
            v_city_norm ILIKE '%' || public._strip_accents(c.name) || '%'
         OR public._strip_accents(c.name) ILIKE '%' || v_city_norm || '%'
       )
       AND (NEW.state IS NULL OR c.state = NEW.state OR c.state_uf = NEW.state)
       AND c.latitude IS NOT NULL
       AND c.longitude IS NOT NULL
     ORDER BY COALESCE(c.provider_count, 0) DESC, length(c.name) ASC
     LIMIT 1;
  END IF;

  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    NEW.latitude := v_lat;
    NEW.longitude := v_lng;
    NEW.geo_source := CASE
      WHEN v_prev_source = 'gps' THEN 'gps_plus_city_center'
      WHEN v_prev_source = 'address_geocode' THEN 'gps_plus_address_geocode'
      WHEN v_prev_source = 'gps_plus_address_geocode' THEN 'gps_plus_address_geocode'
      ELSE 'city_center'
    END;
    NEW.geo_source_confidence := COALESCE(NEW.geo_source_confidence, 0.55);
    NEW.geo_source_updated_at := now();
    NEW.geo_source_notes := COALESCE(NEW.geo_source_notes, '{}'::jsonb) || jsonb_build_object(
      'fallback_city', NEW.city,
      'fallback_state', NEW.state,
      'fallback_applied_at', now()
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM public.log_provider_geo_issue(
    COALESCE(NEW.id, OLD.id),
    'trigger_error',
    COALESCE(NEW.geo_source, OLD.geo_source, 'unknown'),
    'error',
    SQLERRM,
    jsonb_build_object('city', NEW.city, 'state', NEW.state, 'trigger', 'fill_provider_coords_from_city')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_provider_geo_audit_from_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.city IS NULL OR trim(NEW.city) = '' THEN
      PERFORM public.log_provider_geo_issue(
        NEW.id,
        'missing_city',
        COALESCE(NEW.geo_source, 'unknown'),
        'warning',
        'Provider salvo sem cidade preenchida',
        jsonb_build_object('state', NEW.state, 'status', NEW.status)
      );
    ELSIF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
      PERFORM public.log_provider_geo_issue(
        NEW.id,
        'missing_coords',
        COALESCE(NEW.geo_source, 'unknown'),
        'warning',
        'Provider salvo com cidade mas sem latitude/longitude',
        jsonb_build_object('city', NEW.city, 'state', NEW.state, 'status', NEW.status)
      );
    ELSIF NEW.geo_source IN ('city_center', 'gps_plus_city_center') THEN
      PERFORM public.set_provider_geo_source(
        NEW.id,
        NEW.geo_source,
        COALESCE(NEW.geo_source_confidence, 0.55),
        jsonb_build_object('city', NEW.city, 'state', NEW.state, 'reason', 'provider_saved_with_city_fallback'),
        'fallback_applied',
        'needs_review'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.city, '') IS DISTINCT FROM COALESCE(OLD.city, '')
     OR COALESCE(NEW.state, '') IS DISTINCT FROM COALESCE(OLD.state, '')
     OR COALESCE(NEW.neighborhood, '') IS DISTINCT FROM COALESCE(OLD.neighborhood, '')
     OR COALESCE(NEW.latitude, 0) IS DISTINCT FROM COALESCE(OLD.latitude, 0)
     OR COALESCE(NEW.longitude, 0) IS DISTINCT FROM COALESCE(OLD.longitude, 0)
     OR COALESCE(NEW.geo_source, '') IS DISTINCT FROM COALESCE(OLD.geo_source, '') THEN

    IF NEW.city IS NULL OR trim(NEW.city) = '' THEN
      PERFORM public.log_provider_geo_issue(
        NEW.id,
        'missing_city',
        COALESCE(NEW.geo_source, 'unknown'),
        'warning',
        'Provider atualizado sem cidade preenchida',
        jsonb_build_object('state', NEW.state, 'status', NEW.status)
      );
    ELSIF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
      PERFORM public.log_provider_geo_issue(
        NEW.id,
        'missing_coords',
        COALESCE(NEW.geo_source, 'unknown'),
        'warning',
        'Provider atualizado com cidade mas sem latitude/longitude',
        jsonb_build_object('city', NEW.city, 'state', NEW.state, 'status', NEW.status)
      );
    ELSIF NEW.geo_source IN ('city_center', 'gps_plus_city_center')
      AND (
        COALESCE(OLD.latitude, 0) IS DISTINCT FROM COALESCE(NEW.latitude, 0)
        OR COALESCE(OLD.longitude, 0) IS DISTINCT FROM COALESCE(NEW.longitude, 0)
        OR COALESCE(OLD.geo_source, '') IS DISTINCT FROM COALESCE(NEW.geo_source, '')
      ) THEN
      PERFORM public.set_provider_geo_source(
        NEW.id,
        NEW.geo_source,
        COALESCE(NEW.geo_source_confidence, 0.55),
        jsonb_build_object('city', NEW.city, 'state', NEW.state, 'reason', 'provider_updated_with_city_fallback'),
        'fallback_applied',
        'needs_review'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_provider_geo_audit_from_provider ON public.providers;
CREATE TRIGGER trg_sync_provider_geo_audit_from_provider
AFTER INSERT OR UPDATE OF city, state, neighborhood, latitude, longitude, geo_source
ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.sync_provider_geo_audit_from_provider();

UPDATE public.providers
SET geo_source = CASE
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND city IS NOT NULL AND trim(city) <> '' THEN COALESCE(NULLIF(geo_source, 'unknown'), 'city_center')
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN COALESCE(NULLIF(geo_source, 'unknown'), 'gps')
      ELSE COALESCE(geo_source, 'unknown')
    END,
    geo_source_confidence = CASE
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND city IS NOT NULL AND trim(city) <> '' THEN COALESCE(geo_source_confidence, 0.55)
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN COALESCE(geo_source_confidence, 0.95)
      ELSE geo_source_confidence
    END,
    geo_source_updated_at = COALESCE(geo_source_updated_at, now())
WHERE deleted_at IS NULL;

INSERT INTO public.provider_geo_audit (
  provider_id,
  event_type,
  source,
  status,
  city,
  state,
  neighborhood,
  latitude,
  longitude,
  error_message,
  payload
)
SELECT
  p.id,
  CASE
    WHEN p.city IS NULL OR trim(p.city) = '' THEN 'missing_city'
    WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 'missing_coords'
    ELSE 'fallback_applied'
  END,
  COALESCE(p.geo_source, 'unknown'),
  CASE
    WHEN p.city IS NULL OR trim(p.city) = '' THEN 'warning'
    WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 'warning'
    WHEN p.geo_source IN ('city_center', 'gps_plus_city_center') THEN 'needs_review'
    ELSE 'logged'
  END,
  p.city,
  p.state,
  p.neighborhood,
  p.latitude,
  p.longitude,
  CASE
    WHEN p.city IS NULL OR trim(p.city) = '' THEN 'Provider sem cidade para geocodificação'
    WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 'Provider sem coordenadas após backfill'
    WHEN p.geo_source IN ('city_center', 'gps_plus_city_center') THEN 'Provider usando fallback do centro da cidade'
    ELSE NULL
  END,
  jsonb_build_object('backfill', true)
FROM public.providers p
WHERE p.deleted_at IS NULL
  AND (
    p.city IS NULL OR trim(p.city) = ''
    OR p.latitude IS NULL OR p.longitude IS NULL
    OR p.geo_source IN ('city_center', 'gps_plus_city_center')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.provider_geo_audit a
    WHERE a.provider_id = p.id
      AND a.payload->>'backfill' = 'true'
      AND a.event_type = CASE
        WHEN p.city IS NULL OR trim(p.city) = '' THEN 'missing_city'
        WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 'missing_coords'
        ELSE 'fallback_applied'
      END
  );