-- =========================================================
-- FASE A · Observabilidade + Idempotência do tracking
-- =========================================================

-- 1) Saúde dos RPCs de tracking -----------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_rpc_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rpc_name text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success','error')),
  error_code text,
  error_message text,
  latency_ms integer,
  pathname text,
  is_authenticated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tracking_rpc_health TO authenticated;
GRANT ALL ON public.tracking_rpc_health TO service_role;

ALTER TABLE public.tracking_rpc_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read tracking rpc health" ON public.tracking_rpc_health;
CREATE POLICY "Admins read tracking rpc health"
  ON public.tracking_rpc_health FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Deny direct inserts on tracking_rpc_health" ON public.tracking_rpc_health;
CREATE POLICY "Deny direct inserts on tracking_rpc_health"
  ON public.tracking_rpc_health FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_tracking_rpc_health_recent
  ON public.tracking_rpc_health (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_rpc_health_rpc
  ON public.tracking_rpc_health (rpc_name, outcome, created_at DESC);

-- 2) Dedupe / idempotência ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_event_dedupe (
  dedupe_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tracking_event_dedupe TO service_role;
ALTER TABLE public.tracking_event_dedupe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to tracking_event_dedupe" ON public.tracking_event_dedupe;
CREATE POLICY "No direct access to tracking_event_dedupe"
  ON public.tracking_event_dedupe FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_tracking_event_dedupe_created
  ON public.tracking_event_dedupe (created_at);

-- Retorna TRUE quando a chave é nova (evento deve ser processado).
CREATE OR REPLACE FUNCTION public.tracking_dedupe_take(_key text, _ttl_minutes integer DEFAULT 10)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
  v_inserted boolean := false;
BEGIN
  v_key := NULLIF(trim(_key), '');
  IF v_key IS NULL THEN
    RETURN true; -- sem chave => sem dedupe
  END IF;
  IF length(v_key) > 200 THEN
    v_key := left(v_key, 200);
  END IF;

  DELETE FROM public.tracking_event_dedupe
   WHERE dedupe_key = v_key
     AND created_at < now() - make_interval(mins => GREATEST(1, COALESCE(_ttl_minutes, 10)));

  INSERT INTO public.tracking_event_dedupe (dedupe_key)
  VALUES (v_key)
  ON CONFLICT (dedupe_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.tracking_dedupe_take(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tracking_dedupe_take(text, integer) TO service_role;

-- Limpeza (chamada pelo cron existente / manual)
CREATE OR REPLACE FUNCTION public.purge_tracking_observability()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.tracking_event_dedupe WHERE created_at < now() - interval '2 days';
  DELETE FROM public.tracking_rpc_health WHERE created_at < now() - interval '30 days';
$$;

REVOKE ALL ON FUNCTION public.purge_tracking_observability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_tracking_observability() TO service_role;

-- 3) Ingestão da saúde do tracking (chamada pelo cliente, com amostragem) --
CREATE OR REPLACE FUNCTION public.record_tracking_rpc_health(
  _rpc_name text,
  _outcome text,
  _error_code text DEFAULT NULL,
  _error_message text DEFAULT NULL,
  _latency_ms integer DEFAULT NULL,
  _pathname text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rpc text := lower(NULLIF(trim(_rpc_name), ''));
  v_outcome text := lower(NULLIF(trim(_outcome), ''));
  v_allowed boolean;
BEGIN
  IF v_rpc IS NULL OR v_rpc NOT IN (
    'track_sponsor_metric','log_search_intent','record_public_funnel_event'
  ) THEN
    RETURN;
  END IF;
  IF v_outcome NOT IN ('success','error') THEN
    RETURN;
  END IF;

  BEGIN
    v_allowed := public.check_rate_limit(
      'tracking_health:' || COALESCE(auth.uid()::text, 'anon'), 240, 60
    );
    IF NOT COALESCE(v_allowed, true) THEN
      RETURN;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.tracking_rpc_health (
    rpc_name, outcome, error_code, error_message, latency_ms, pathname, is_authenticated
  ) VALUES (
    v_rpc,
    v_outcome,
    left(NULLIF(trim(_error_code), ''), 20),
    left(NULLIF(trim(_error_message), ''), 300),
    GREATEST(0, LEAST(COALESCE(_latency_ms, 0), 120000)),
    left(NULLIF(trim(_pathname), ''), 200),
    auth.uid() IS NOT NULL
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.record_tracking_rpc_health(text, text, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_tracking_rpc_health(text, text, text, text, integer, text)
  TO anon, authenticated, service_role;

-- 4) Resumo para o painel admin ------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_tracking_rpc_health_summary(_hours integer DEFAULT 24)
RETURNS TABLE (
  rpc_name text,
  total bigint,
  successes bigint,
  errors bigint,
  error_rate numeric,
  permission_denied bigint,
  avg_latency_ms numeric,
  last_error_at timestamptz,
  top_error_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_since timestamptz := now() - make_interval(hours => GREATEST(1, LEAST(COALESCE(_hours, 24), 720)));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    h.rpc_name,
    count(*)::bigint,
    count(*) FILTER (WHERE h.outcome = 'success')::bigint,
    count(*) FILTER (WHERE h.outcome = 'error')::bigint,
    ROUND((count(*) FILTER (WHERE h.outcome = 'error'))::numeric
          / NULLIF(count(*), 0)::numeric * 100, 2),
    count(*) FILTER (WHERE h.error_code = '42501')::bigint,
    ROUND(AVG(h.latency_ms)::numeric, 1),
    MAX(h.created_at) FILTER (WHERE h.outcome = 'error'),
    (
      SELECT e.error_code FROM public.tracking_rpc_health e
       WHERE e.rpc_name = h.rpc_name AND e.outcome = 'error'
         AND e.created_at >= v_since AND e.error_code IS NOT NULL
       GROUP BY e.error_code ORDER BY count(*) DESC LIMIT 1
    )
  FROM public.tracking_rpc_health h
  WHERE h.created_at >= v_since
  GROUP BY h.rpc_name
  ORDER BY 5 DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_tracking_rpc_health_summary(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_tracking_rpc_health_summary(integer) TO authenticated, service_role;

-- Série temporal + erros recentes
CREATE OR REPLACE FUNCTION public.admin_tracking_rpc_health_errors(_hours integer DEFAULT 24, _limit integer DEFAULT 100)
RETURNS TABLE (
  created_at timestamptz,
  rpc_name text,
  error_code text,
  error_message text,
  pathname text,
  is_authenticated boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT h.created_at, h.rpc_name, h.error_code, h.error_message, h.pathname, h.is_authenticated
    FROM public.tracking_rpc_health h
   WHERE h.outcome = 'error'
     AND h.created_at >= now() - make_interval(hours => GREATEST(1, LEAST(COALESCE(_hours, 24), 720)))
   ORDER BY h.created_at DESC
   LIMIT GREATEST(1, LEAST(COALESCE(_limit, 100), 500));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_tracking_rpc_health_errors(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_tracking_rpc_health_errors(integer, integer) TO authenticated, service_role;

-- 5) Idempotência nos RPCs de tracking ------------------------------------
CREATE OR REPLACE FUNCTION public.track_sponsor_metric(
  _sponsor_id uuid,
  _slot_slug text,
  _event_type text,
  _page_path text DEFAULT NULL::text,
  _dedupe_key text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_ref text;
  v_ttl integer;
BEGIN
  IF _event_type NOT IN ('impression','click') THEN
    RETURN;
  END IF;

  IF NULLIF(trim(COALESCE(_dedupe_key, '')), '') IS NOT NULL THEN
    v_ttl := CASE WHEN _event_type = 'impression' THEN 30 ELSE 5 END;
    IF NOT public.tracking_dedupe_take('sm:' || _dedupe_key, v_ttl) THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.sponsor_metrics (
    sponsor_id, slot_slug, event_type, page_path, event_date, count
  )
  VALUES (_sponsor_id, _slot_slug, _event_type, _page_path, CURRENT_DATE, 1)
  ON CONFLICT (sponsor_id, slot_slug, event_type, (COALESCE(page_path, '')), event_date)
  DO UPDATE SET count = public.sponsor_metrics.count + 1;

  IF _event_type = 'impression' THEN
    UPDATE public.sponsors SET impressions = impressions + 1 WHERE id = _sponsor_id;
    UPDATE public.sponsors
       SET delivered_impressions = delivered_impressions + 1
     WHERE id = _sponsor_id AND plan = 'pro';
  ELSIF _event_type = 'click' THEN
    UPDATE public.sponsors SET clicks = clicks + 1 WHERE id = _sponsor_id;
  END IF;

  SELECT user_ref INTO v_user_ref FROM public.sponsors WHERE id = _sponsor_id;

  IF _event_type = 'click' AND v_user_ref IS NOT NULL THEN
    INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'sponsor_ad_click',
      'sponsor',
      _sponsor_id,
      jsonb_build_object(
        'slot_slug', _slot_slug,
        'page_path', _page_path,
        'sponsor_user_ref', v_user_ref
      )
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.track_sponsor_metric(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_sponsor_metric(uuid, text, text, text, text)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_search_intent(
  _category_slug text DEFAULT NULL::text,
  _category_name text DEFAULT NULL::text,
  _city text DEFAULT NULL::text,
  _state text DEFAULT NULL::text,
  _visitor_id text DEFAULT NULL::text,
  _dedupe_key text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_identifier text;
  v_allowed boolean;
BEGIN
  IF _category_slug IS NOT NULL AND length(_category_slug) > 120 THEN RETURN NULL; END IF;
  IF _category_name IS NOT NULL AND length(_category_name) > 120 THEN RETURN NULL; END IF;
  IF _city IS NOT NULL AND length(_city) > 120 THEN RETURN NULL; END IF;
  IF _state IS NOT NULL AND length(_state) > 2 THEN RETURN NULL; END IF;
  IF _visitor_id IS NOT NULL AND length(_visitor_id) > 120 THEN
    _visitor_id := substring(_visitor_id, 1, 120);
  END IF;

  IF NULLIF(trim(COALESCE(_dedupe_key, '')), '') IS NOT NULL THEN
    IF NOT public.tracking_dedupe_take('si:' || _dedupe_key, 10) THEN
      RETURN NULL;
    END IF;
  END IF;

  v_identifier := coalesce(auth.uid()::text, _visitor_id, 'anon');
  BEGIN
    v_allowed := public.check_rate_limit('search_intent:' || v_identifier, 120, 60);
    IF NOT coalesce(v_allowed, true) THEN
      RETURN NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.search_intent_log (
    category_slug, category_name, city, state, visitor_id, user_id
  ) VALUES (
    _category_slug, _category_name, _city, _state, _visitor_id, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_search_intent(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_search_intent(text, text, text, text, text, text)
  TO anon, authenticated, service_role;

-- Funil: aceita chave de idempotência explícita do cliente
CREATE OR REPLACE FUNCTION public.record_public_funnel_event(
  _action text,
  _category text DEFAULT NULL::text,
  _city text DEFAULT NULL::text,
  _term text DEFAULT NULL::text,
  _result_count integer DEFAULT NULL::integer,
  _resource_id text DEFAULT NULL::text,
  _source text DEFAULT NULL::text,
  _pathname text DEFAULT NULL::text,
  _sponsor_ref text DEFAULT NULL::text,
  _dedupe_key text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_path text := COALESCE(NULLIF(trim(_pathname), ''), '/');
  v_action text := lower(COALESCE(NULLIF(trim(_action), ''), ''));
  v_category text := lower(NULLIF(trim(_category), ''));
  v_city text := lower(NULLIF(trim(_city), ''));
  v_source text := NULLIF(trim(_source), '');
  v_term text := NULLIF(trim(_term), '');
  v_sponsor_ref uuid;
  v_dedup_key text;
  v_ua text;
BEGIN
  IF v_action NOT IN ('public_search','category_view','city_view','profile_view','lead_submit','internal_link_click') THEN
    RETURN;
  END IF;

  BEGIN
    v_ua := lower(COALESCE(current_setting('request.headers', true)::jsonb->>'user-agent', ''));
  EXCEPTION WHEN OTHERS THEN
    v_ua := '';
  END;
  IF v_ua <> '' AND v_ua ~ '(bot|crawler|spider|crawling|headlesschrome|phantomjs|httrack|wget|curl/|python-requests|axios/|scrapy|facebookexternalhit|whatsapp|telegrambot|slackbot|discordbot|bingpreview|google-inspectiontool|chrome-lighthouse)' THEN
    RETURN;
  END IF;

  IF v_term IS NOT NULL THEN
    IF length(v_term) > 80 THEN
      v_term := left(v_term, 80);
    END IF;
    IF v_term ~ '(\d{8,}|@)' THEN
      v_term := NULL;
    END IF;
  END IF;

  IF NULLIF(trim(COALESCE(_dedupe_key, '')), '') IS NOT NULL THEN
    IF NOT public.tracking_dedupe_take('pf:' || _dedupe_key, 10) THEN
      RETURN;
    END IF;
  END IF;

  BEGIN
    v_sponsor_ref := NULLIF(trim(_sponsor_ref), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_sponsor_ref := NULL;
  END;

  v_dedup_key := concat_ws('|', v_action, v_category, v_city, COALESCE(v_term, ''), COALESCE(NULLIF(_resource_id, ''), ''), v_path);

  IF EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE action = v_action
      AND resource_type = 'public_funnel'
      AND created_at > now() - interval '10 minutes'
      AND details->>'dedup_key' = v_dedup_key
      AND COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid) = v_uid
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    v_uid,
    v_action,
    'public_funnel',
    NULLIF(_resource_id, ''),
    jsonb_build_object(
      'category', v_category,
      'city', v_city,
      'term', v_term,
      'result_count', _result_count,
      'source', v_source,
      'pathname', v_path,
      'sponsor_ref', v_sponsor_ref,
      'dedup_key', v_dedup_key
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.record_public_funnel_event(text, text, text, text, integer, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_public_funnel_event(text, text, text, text, integer, text, text, text, text, text)
  TO anon, authenticated, service_role;

-- Remove as assinaturas antigas para evitar ambiguidade de overload no PostgREST
DROP FUNCTION IF EXISTS public.record_public_funnel_event(text, text, text, text, integer, text, text, text, text);
DROP FUNCTION IF EXISTS public.log_search_intent(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.track_sponsor_metric(uuid, text, text, text);

-- 6) Segurança: reforço explícito de colunas sensíveis de sponsors --------
REVOKE SELECT ON public.sponsors FROM anon;
REVOKE SELECT (cnpj, email, phone, whatsapp) ON public.sponsors FROM anon;
