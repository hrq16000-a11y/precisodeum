-- =====================================================================
-- Fase 2.3 — Sponsor ROI Layer
-- Atribuição leve baseada em sessionStorage (sponsor_ref no audit_log).
-- =====================================================================

-- 1) Estende record_public_funnel_event para aceitar sponsor_ref opcional.
CREATE OR REPLACE FUNCTION public.record_public_funnel_event(
  _action text,
  _category text DEFAULT NULL,
  _city text DEFAULT NULL,
  _term text DEFAULT NULL,
  _result_count int DEFAULT NULL,
  _resource_id text DEFAULT NULL,
  _source text DEFAULT NULL,
  _pathname text DEFAULT NULL,
  _sponsor_ref text DEFAULT NULL
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
  v_sponsor_ref uuid;
  v_dedup_key text;
  v_ua text;
BEGIN
  IF v_action NOT IN ('public_search', 'category_view', 'city_view', 'profile_view', 'lead_submit') THEN
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
    IF v_term ~ '\d{8,}' OR v_term ~ '@' THEN
      v_term := NULL;
    ELSE
      v_term := lower(v_term);
    END IF;
  END IF;

  -- sponsor_ref: aceita UUID válido apenas (silenciosamente descarta inválido).
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
    jsonb_strip_nulls(jsonb_build_object(
      'category',     v_category,
      'city',         v_city,
      'term',         v_term,
      'result_count', _result_count,
      'source',       v_source,
      'pathname',     v_path,
      'dedup_key',    v_dedup_key,
      'sponsor_ref',  v_sponsor_ref::text
    ))
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_public_funnel_event(text, text, text, text, int, text, text, text, text) TO anon, authenticated;

-- 2) Patch leve no telemetry agregador: usar event_date (estava 'day').
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
  v_profile_views_funnel int;
  v_whatsapp_clicks int;
  v_phone_clicks int;
  v_leads int;
  v_lead_submits int;
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

  SELECT count(*) INTO v_searches FROM public.audit_log WHERE action = 'public_search' AND created_at >= v_since;
  SELECT count(*) INTO v_searches_today FROM public.audit_log WHERE action = 'public_search' AND created_at >= date_trunc('day', now());
  SELECT count(*) INTO v_zero FROM public.audit_log WHERE action = 'public_search' AND created_at >= v_since AND (details->>'result_count')::int = 0;
  SELECT count(*) INTO v_profile_views FROM public.audit_log WHERE action = 'profile_view' AND created_at >= v_since;
  SELECT count(*) INTO v_profile_views_funnel FROM public.audit_log WHERE action = 'profile_view' AND resource_type = 'public_funnel' AND created_at >= v_since;
  SELECT count(*) INTO v_whatsapp_clicks FROM public.audit_log WHERE action = 'whatsapp_click' AND created_at >= v_since;
  SELECT count(*) INTO v_phone_clicks FROM public.audit_log WHERE action = 'phone_click' AND created_at >= v_since;
  SELECT count(*) INTO v_leads FROM public.leads WHERE created_at >= v_since;
  SELECT count(*) INTO v_lead_submits FROM public.audit_log WHERE action = 'lead_submit' AND resource_type = 'public_funnel' AND created_at >= v_since;

  SELECT COALESCE(SUM(count) FILTER (WHERE event_type = 'click'), 0)::int INTO v_sponsor_clicks
  FROM public.sponsor_metrics WHERE event_date >= v_since::date;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('term', term, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_top_terms
  FROM (
    SELECT details->>'term' AS term, count(*) AS cnt
    FROM public.audit_log WHERE action = 'public_search' AND created_at >= v_since
      AND NULLIF(details->>'term','') IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('term', term, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_zero_terms
  FROM (
    SELECT details->>'term' AS term, count(*) AS cnt
    FROM public.audit_log WHERE action = 'public_search' AND created_at >= v_since
      AND (details->>'result_count')::int = 0 AND NULLIF(details->>'term','') IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_top_categories
  FROM (
    SELECT details->>'category' AS category, count(*) AS cnt
    FROM public.audit_log WHERE action IN ('public_search','category_view') AND created_at >= v_since
      AND NULLIF(details->>'category','') IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('city', city, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_top_cities
  FROM (
    SELECT details->>'city' AS city, count(*) AS cnt
    FROM public.audit_log WHERE action IN ('public_search','city_view') AND created_at >= v_since
      AND NULLIF(details->>'city','') IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('provider_id', t.pid, 'name', p.name, 'city', p.city, 'contacts', t.cnt)
    ORDER BY t.cnt DESC
  ), '[]'::jsonb)
  INTO v_top_providers
  FROM (
    SELECT resource_id::uuid AS pid, count(*) AS cnt
    FROM public.audit_log WHERE action IN ('whatsapp_click','phone_click') AND created_at >= v_since
      AND resource_id IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 20
  ) t
  LEFT JOIN public.providers p ON p.id = t.pid;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('sponsor_id', t.sid, 'title', s.title, 'clicks', t.clicks, 'impressions', t.impressions)
    ORDER BY t.clicks DESC
  ), '[]'::jsonb)
  INTO v_top_sponsors
  FROM (
    SELECT sponsor_id AS sid,
      COALESCE(SUM(count) FILTER (WHERE event_type='click'),0)::int AS clicks,
      COALESCE(SUM(count) FILTER (WHERE event_type='impression'),0)::int AS impressions
    FROM public.sponsor_metrics WHERE event_date >= v_since::date
    GROUP BY sponsor_id ORDER BY 2 DESC NULLS LAST LIMIT 20
  ) t
  LEFT JOIN public.sponsors s ON s.id = t.sid;

  RETURN jsonb_build_object(
    'window_days', _days,
    'searches', v_searches,
    'searches_today', v_searches_today,
    'zero_result_searches', v_zero,
    'profile_views', v_profile_views,
    'profile_views_funnel', v_profile_views_funnel,
    'whatsapp_clicks', v_whatsapp_clicks,
    'phone_clicks', v_phone_clicks,
    'leads', v_leads,
    'lead_submits', v_lead_submits,
    'sponsor_clicks', v_sponsor_clicks,
    'ctr_search_to_view', CASE WHEN v_searches > 0 THEN round((v_profile_views::numeric / v_searches)*100,2) ELSE 0 END,
    'ctr_view_to_contact', CASE WHEN v_profile_views > 0 THEN round(((v_whatsapp_clicks+v_phone_clicks)::numeric / v_profile_views)*100,2) ELSE 0 END,
    'ctr_view_to_lead', CASE WHEN v_profile_views > 0 THEN round((v_lead_submits::numeric / v_profile_views)*100,2) ELSE 0 END,
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

-- 3) ROI por sponsor (owner ou admin)
CREATE OR REPLACE FUNCTION public.get_sponsor_roi(_sponsor_id uuid, _days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
  v_owner_ok boolean := false;
  v_since timestamptz;
  v_since_date date;
  v_impressions int;
  v_clicks int;
  v_profile_views int;
  v_lead_submits int;
  v_top_slots jsonb;
  v_top_cities jsonb;
  v_by_day jsonb;
BEGIN
  IF _sponsor_id IS NULL THEN
    RAISE EXCEPTION 'sponsor_id_required';
  END IF;

  BEGIN
    v_is_admin := public.has_role(auth.uid(), 'admin');
  EXCEPTION WHEN OTHERS THEN v_is_admin := false;
  END;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.sponsors s WHERE s.id = _sponsor_id AND s.user_id = auth.uid()) INTO v_owner_ok;
  END IF;

  IF NOT v_is_admin AND NOT v_owner_ok THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_since := now() - make_interval(days => GREATEST(1, LEAST(_days, 180)));
  v_since_date := v_since::date;

  SELECT COALESCE(SUM(count) FILTER (WHERE event_type='impression'),0)::int,
         COALESCE(SUM(count) FILTER (WHERE event_type='click'),0)::int
  INTO v_impressions, v_clicks
  FROM public.sponsor_metrics
  WHERE sponsor_id = _sponsor_id AND event_date >= v_since_date;

  SELECT count(*) INTO v_profile_views
  FROM public.audit_log
  WHERE action='profile_view' AND resource_type='public_funnel'
    AND created_at >= v_since
    AND details->>'sponsor_ref' = _sponsor_id::text;

  SELECT count(*) INTO v_lead_submits
  FROM public.audit_log
  WHERE action='lead_submit' AND resource_type='public_funnel'
    AND created_at >= v_since
    AND details->>'sponsor_ref' = _sponsor_id::text;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'slot', slot_slug,
    'impressions', impressions,
    'clicks', clicks,
    'ctr', CASE WHEN impressions>0 THEN round((clicks::numeric/impressions)*100,2) ELSE 0 END
  ) ORDER BY impressions DESC), '[]'::jsonb)
  INTO v_top_slots
  FROM (
    SELECT slot_slug,
      COALESCE(SUM(count) FILTER (WHERE event_type='impression'),0)::int AS impressions,
      COALESCE(SUM(count) FILTER (WHERE event_type='click'),0)::int      AS clicks
    FROM public.sponsor_metrics
    WHERE sponsor_id = _sponsor_id AND event_date >= v_since_date
    GROUP BY slot_slug
    ORDER BY 2 DESC LIMIT 10
  ) t;

  -- Cidades a partir do public_funnel atribuído ao sponsor
  SELECT COALESCE(jsonb_agg(jsonb_build_object('city', city, 'views', views, 'leads', leads) ORDER BY views DESC), '[]'::jsonb)
  INTO v_top_cities
  FROM (
    SELECT details->>'city' AS city,
      count(*) FILTER (WHERE action='profile_view') AS views,
      count(*) FILTER (WHERE action='lead_submit')  AS leads
    FROM public.audit_log
    WHERE resource_type='public_funnel'
      AND action IN ('profile_view','lead_submit')
      AND created_at >= v_since
      AND details->>'sponsor_ref' = _sponsor_id::text
      AND NULLIF(details->>'city','') IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ) t;

  -- Série diária para gráfico simples
  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d, 'impressions', imp, 'clicks', cl) ORDER BY d), '[]'::jsonb)
  INTO v_by_day
  FROM (
    SELECT event_date AS d,
      COALESCE(SUM(count) FILTER (WHERE event_type='impression'),0)::int AS imp,
      COALESCE(SUM(count) FILTER (WHERE event_type='click'),0)::int      AS cl
    FROM public.sponsor_metrics
    WHERE sponsor_id = _sponsor_id AND event_date >= v_since_date
    GROUP BY 1 ORDER BY 1
  ) t;

  RETURN jsonb_build_object(
    'sponsor_id', _sponsor_id,
    'window_days', _days,
    'impressions', v_impressions,
    'clicks', v_clicks,
    'profile_views', v_profile_views,
    'lead_submits', v_lead_submits,
    'ctr_impression_to_click', CASE WHEN v_impressions>0 THEN round((v_clicks::numeric/v_impressions)*100,2) ELSE 0 END,
    'ctr_click_to_view',       CASE WHEN v_clicks>0 THEN round((v_profile_views::numeric/v_clicks)*100,2) ELSE 0 END,
    'ctr_view_to_lead',        CASE WHEN v_profile_views>0 THEN round((v_lead_submits::numeric/v_profile_views)*100,2) ELSE 0 END,
    'ctr_click_to_lead',       CASE WHEN v_clicks>0 THEN round((v_lead_submits::numeric/v_clicks)*100,2) ELSE 0 END,
    'top_slots', v_top_slots,
    'top_cities', v_top_cities,
    'by_day', v_by_day
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sponsor_roi(uuid, int) TO authenticated;

-- 4) ROI agregado para admin: ranking de sponsors / slots / cidades
CREATE OR REPLACE FUNCTION public.get_admin_sponsor_roi(_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
  v_since_date date;
  v_top_sponsors jsonb;
  v_top_slots jsonb;
  v_top_cities jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_since := now() - make_interval(days => GREATEST(1, LEAST(_days, 180)));
  v_since_date := v_since::date;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (t.lead_submits) DESC NULLS LAST, (t.profile_views) DESC NULLS LAST), '[]'::jsonb)
  INTO v_top_sponsors
  FROM (
    SELECT
      s.id AS sponsor_id,
      COALESCE(s.company_name, s.title, s.id::text) AS name,
      m.impressions,
      m.clicks,
      f.profile_views,
      f.lead_submits,
      CASE WHEN m.impressions>0 THEN round((m.clicks::numeric/m.impressions)*100,2) ELSE 0 END AS ctr,
      CASE WHEN f.profile_views>0 THEN round((f.lead_submits::numeric/f.profile_views)*100,2) ELSE 0 END AS conv_view_lead
    FROM public.sponsors s
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(count) FILTER (WHERE event_type='impression'),0)::int AS impressions,
             COALESCE(SUM(count) FILTER (WHERE event_type='click'),0)::int      AS clicks
      FROM public.sponsor_metrics sm
      WHERE sm.sponsor_id = s.id AND sm.event_date >= v_since_date
    ) m ON true
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE action='profile_view')::int AS profile_views,
        count(*) FILTER (WHERE action='lead_submit')::int  AS lead_submits
      FROM public.audit_log al
      WHERE al.resource_type='public_funnel'
        AND al.created_at >= v_since
        AND al.details->>'sponsor_ref' = s.id::text
    ) f ON true
    WHERE (m.impressions > 0 OR f.profile_views > 0 OR f.lead_submits > 0)
    ORDER BY f.lead_submits DESC NULLS LAST, m.clicks DESC NULLS LAST
    LIMIT 30
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'slot', slot_slug,
    'impressions', impressions,
    'clicks', clicks,
    'ctr', CASE WHEN impressions>0 THEN round((clicks::numeric/impressions)*100,2) ELSE 0 END
  ) ORDER BY impressions DESC), '[]'::jsonb)
  INTO v_top_slots
  FROM (
    SELECT slot_slug,
      COALESCE(SUM(count) FILTER (WHERE event_type='impression'),0)::int AS impressions,
      COALESCE(SUM(count) FILTER (WHERE event_type='click'),0)::int      AS clicks
    FROM public.sponsor_metrics
    WHERE event_date >= v_since_date
    GROUP BY slot_slug ORDER BY 2 DESC LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('city', city, 'views', views, 'leads', leads) ORDER BY views DESC), '[]'::jsonb)
  INTO v_top_cities
  FROM (
    SELECT details->>'city' AS city,
      count(*) FILTER (WHERE action='profile_view')::int AS views,
      count(*) FILTER (WHERE action='lead_submit')::int  AS leads
    FROM public.audit_log
    WHERE resource_type='public_funnel'
      AND action IN ('profile_view','lead_submit')
      AND created_at >= v_since
      AND NULLIF(details->>'sponsor_ref','') IS NOT NULL
      AND NULLIF(details->>'city','') IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  RETURN jsonb_build_object(
    'window_days', _days,
    'top_sponsors', v_top_sponsors,
    'top_slots', v_top_slots,
    'top_cities', v_top_cities
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_sponsor_roi(int) TO authenticated;