
-- Fase 2.1 — Public Funnel Telemetry

-- RPC 1: fire-and-forget para eventos públicos do funil
-- Ações suportadas: 'public_search', 'category_view', 'city_view'
CREATE OR REPLACE FUNCTION public.record_public_funnel_event(
  _action text,
  _category text DEFAULT NULL,
  _city text DEFAULT NULL,
  _term text DEFAULT NULL,
  _result_count int DEFAULT NULL,
  _resource_id text DEFAULT NULL,
  _source text DEFAULT NULL,
  _pathname text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_path text := COALESCE(NULLIF(trim(_pathname), ''), '/');
  v_action text := lower(COALESCE(NULLIF(trim(_action), ''), ''));
  v_category text := lower(NULLIF(trim(_category), ''));
  v_city text := lower(NULLIF(trim(_city), ''));
  v_source text := NULLIF(trim(_source), '');
  v_term text := NULLIF(trim(_term), '');
  v_dedup_key text;
BEGIN
  -- whitelist de ações operacionais
  IF v_action NOT IN ('public_search', 'category_view', 'city_view') THEN
    RETURN;
  END IF;

  -- Privacidade: bloqueia termos que parecem telefone (>= 8 dígitos) ou email
  IF v_term IS NOT NULL THEN
    IF length(v_term) > 80 THEN
      v_term := left(v_term, 80);
    END IF;
    IF v_term ~ '\d{8,}' OR v_term ~ '@' THEN
      v_term := NULL;
    ELSE
      v_term := lower(v_term);
    END IF;
  END IF;

  -- Dedup server-side (10 min) por chave de evento
  v_dedup_key := concat_ws('|', v_action, v_category, v_city, COALESCE(v_term, ''), v_path);

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
    jsonb_strip_nulls(jsonb_build_object(
      'category',     v_category,
      'city',         v_city,
      'term',         v_term,
      'result_count', _result_count,
      'source',       v_source,
      'pathname',     v_path,
      'dedup_key',    v_dedup_key
    ))
  );
EXCEPTION WHEN OTHERS THEN
  RETURN; -- fail-soft
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_public_funnel_event(text, text, text, text, int, text, text, text) TO anon, authenticated;

-- RPC 2: agregações admin-only
CREATE OR REPLACE FUNCTION public.get_public_funnel_telemetry(_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
  v_searches int;
  v_searches_today int;
  v_zero int;
  v_profile_views int;
  v_whatsapp_clicks int;
  v_phone_clicks int;
  v_leads int;
  v_sponsor_clicks int;

  v_top_terms jsonb;
  v_zero_terms jsonb;
  v_top_categories jsonb;
  v_top_cities jsonb;
  v_top_providers jsonb;
  v_top_sponsors jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_since := now() - make_interval(days => GREATEST(1, LEAST(_days, 90)));

  SELECT count(*) INTO v_searches
  FROM public.audit_log WHERE action = 'public_search' AND created_at >= v_since;

  SELECT count(*) INTO v_searches_today
  FROM public.audit_log WHERE action = 'public_search' AND created_at >= date_trunc('day', now());

  SELECT count(*) INTO v_zero
  FROM public.audit_log
  WHERE action = 'public_search' AND created_at >= v_since
    AND (details->>'result_count')::int = 0;

  SELECT count(*) INTO v_profile_views
  FROM public.audit_log WHERE action = 'profile_view' AND created_at >= v_since;

  SELECT count(*) INTO v_whatsapp_clicks
  FROM public.audit_log WHERE action = 'whatsapp_click' AND created_at >= v_since;

  SELECT count(*) INTO v_phone_clicks
  FROM public.audit_log WHERE action = 'phone_click' AND created_at >= v_since;

  SELECT count(*) INTO v_leads
  FROM public.leads WHERE created_at >= v_since;

  SELECT COALESCE(sum(clicks), 0)::int INTO v_sponsor_clicks
  FROM public.sponsor_metrics WHERE day >= v_since::date;

  -- Top termos buscados
  SELECT COALESCE(jsonb_agg(jsonb_build_object('term', term, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_top_terms
  FROM (
    SELECT details->>'term' AS term, count(*) AS cnt
    FROM public.audit_log
    WHERE action = 'public_search' AND created_at >= v_since
      AND NULLIF(details->>'term','') IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 20
  ) t;

  -- Top termos com zero resultados (SEO insight: demanda reprimida)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('term', term, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_zero_terms
  FROM (
    SELECT details->>'term' AS term, count(*) AS cnt
    FROM public.audit_log
    WHERE action = 'public_search' AND created_at >= v_since
      AND (details->>'result_count')::int = 0
      AND NULLIF(details->>'term','') IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 20
  ) t;

  -- Top categorias (busca + visualização)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_top_categories
  FROM (
    SELECT details->>'category' AS category, count(*) AS cnt
    FROM public.audit_log
    WHERE action IN ('public_search', 'category_view')
      AND created_at >= v_since
      AND NULLIF(details->>'category','') IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  -- Top cidades (busca + visualização)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('city', city, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_top_cities
  FROM (
    SELECT details->>'city' AS city, count(*) AS cnt
    FROM public.audit_log
    WHERE action IN ('public_search', 'city_view')
      AND created_at >= v_since
      AND NULLIF(details->>'city','') IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  -- Top providers por contato (whatsapp + phone)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'provider_id', t.pid,
      'name', p.name,
      'city', p.city,
      'contacts', t.cnt
    ) ORDER BY t.cnt DESC
  ), '[]'::jsonb)
  INTO v_top_providers
  FROM (
    SELECT resource_id::uuid AS pid, count(*) AS cnt
    FROM public.audit_log
    WHERE action IN ('whatsapp_click', 'phone_click')
      AND created_at >= v_since
      AND resource_id IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 20
  ) t
  LEFT JOIN public.providers p ON p.id = t.pid;

  -- Top sponsors por clique (reutiliza sponsor_metrics)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'sponsor_id', t.sid,
      'title', s.title,
      'clicks', t.clicks,
      'impressions', t.impressions
    ) ORDER BY t.clicks DESC
  ), '[]'::jsonb)
  INTO v_top_sponsors
  FROM (
    SELECT sponsor_id AS sid,
           SUM(clicks)::int AS clicks,
           SUM(impressions)::int AS impressions
    FROM public.sponsor_metrics
    WHERE day >= v_since::date
    GROUP BY sponsor_id
    ORDER BY 2 DESC NULLS LAST LIMIT 20
  ) t
  LEFT JOIN public.sponsors s ON s.id = t.sid;

  RETURN jsonb_build_object(
    'window_days', _days,
    'searches', v_searches,
    'searches_today', v_searches_today,
    'zero_result_searches', v_zero,
    'profile_views', v_profile_views,
    'whatsapp_clicks', v_whatsapp_clicks,
    'phone_clicks', v_phone_clicks,
    'leads', v_leads,
    'sponsor_clicks', v_sponsor_clicks,
    'ctr_search_to_view', CASE WHEN v_searches > 0 THEN round((v_profile_views::numeric / v_searches) * 100, 2) ELSE 0 END,
    'ctr_view_to_contact', CASE WHEN v_profile_views > 0 THEN round(((v_whatsapp_clicks + v_phone_clicks)::numeric / v_profile_views) * 100, 2) ELSE 0 END,
    'top_terms', v_top_terms,
    'zero_result_terms', v_zero_terms,
    'top_categories', v_top_categories,
    'top_cities', v_top_cities,
    'top_providers', v_top_providers,
    'top_sponsors', v_top_sponsors
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_funnel_telemetry(int) TO authenticated;
