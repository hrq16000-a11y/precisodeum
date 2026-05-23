
-- 1) Atualiza whitelist da RPC para incluir internal_link_click
CREATE OR REPLACE FUNCTION public.record_public_funnel_event(
  _action text,
  _category text DEFAULT NULL,
  _city text DEFAULT NULL,
  _term text DEFAULT NULL,
  _result_count integer DEFAULT NULL,
  _resource_id text DEFAULT NULL,
  _source text DEFAULT NULL,
  _pathname text DEFAULT NULL,
  _sponsor_ref text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION public.record_public_funnel_event(text,text,text,text,integer,text,text,text,text) TO anon, authenticated;

-- 2) RPC de health do funil — admin only
CREATE OR REPLACE FUNCTION public.get_public_funnel_health(_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(_days, 7), 90));
  v_since timestamptz := now() - make_interval(days => v_days);
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT
      action,
      created_at,
      COALESCE(user_id::text, '00000000-0000-0000-0000-000000000000') AS sess,
      details->>'pathname'   AS pathname,
      details->>'source'     AS source,
      details->>'sponsor_ref' AS sponsor_ref,
      resource_id            AS target_path
    FROM public.audit_log
    WHERE resource_type = 'public_funnel'
      AND created_at >= v_since
  ),
  by_event AS (
    SELECT action, COUNT(*)::bigint AS n
    FROM base GROUP BY action
  ),
  by_day AS (
    SELECT date_trunc('day', created_at)::date AS d,
           COUNT(*)::bigint AS n,
           COUNT(*) FILTER (WHERE action='internal_link_click')::bigint AS clicks,
           COUNT(*) FILTER (WHERE action='profile_view')::bigint        AS profile_views,
           COUNT(*) FILTER (WHERE action='lead_submit')::bigint         AS lead_submits
    FROM base GROUP BY 1 ORDER BY 1
  ),
  top_source AS (
    SELECT pathname AS path, COUNT(*)::bigint AS clicks
    FROM base
    WHERE action='internal_link_click' AND pathname IS NOT NULL
    GROUP BY pathname ORDER BY clicks DESC LIMIT 20
  ),
  top_target AS (
    SELECT target_path AS path, COUNT(*)::bigint AS clicks
    FROM base
    WHERE action='internal_link_click' AND target_path IS NOT NULL
    GROUP BY target_path ORDER BY clicks DESC LIMIT 20
  ),
  top_landings AS (
    SELECT pathname AS path, COUNT(*)::bigint AS views
    FROM base
    WHERE action IN ('category_view','city_view') AND pathname IS NOT NULL
    GROUP BY pathname ORDER BY views DESC LIMIT 20
  ),
  ctr AS (
    SELECT l.pathname AS path,
           l.views,
           COALESCE(c.clicks, 0) AS clicks,
           CASE WHEN l.views > 0 THEN ROUND((COALESCE(c.clicks,0)::numeric / l.views) * 100, 2) ELSE 0 END AS ctr_pct
    FROM (
      SELECT pathname, COUNT(*)::bigint AS views
      FROM base WHERE action IN ('category_view','city_view') AND pathname IS NOT NULL
      GROUP BY pathname
    ) l
    LEFT JOIN (
      SELECT pathname, COUNT(*)::bigint AS clicks
      FROM base WHERE action='internal_link_click' AND pathname IS NOT NULL
      GROUP BY pathname
    ) c ON c.pathname = l.pathname
    ORDER BY l.views DESC LIMIT 30
  ),
  orphans AS (
    SELECT pathname AS path, COUNT(*)::bigint AS views
    FROM base
    WHERE action IN ('category_view','city_view') AND pathname IS NOT NULL
      AND pathname NOT IN (
        SELECT DISTINCT pathname FROM base
        WHERE action='internal_link_click' AND pathname IS NOT NULL
      )
    GROUP BY pathname ORDER BY views DESC LIMIT 20
  ),
  recent AS (
    SELECT action,
           created_at,
           pathname,
           target_path,
           source,
           sponsor_ref
    FROM base ORDER BY created_at DESC LIMIT 50
  )
  SELECT jsonb_build_object(
    'window_days', v_days,
    'since', v_since,
    'total_events',         (SELECT COUNT(*) FROM base),
    'events_today',         (SELECT COUNT(*) FROM base WHERE created_at >= date_trunc('day', now())),
    'unique_paths',         (SELECT COUNT(DISTINCT pathname) FROM base WHERE pathname IS NOT NULL),
    'unique_sessions',      (SELECT COUNT(DISTINCT sess) FROM base),
    'internal_link_clicks', COALESCE((SELECT n FROM by_event WHERE action='internal_link_click'), 0),
    'profile_views',        COALESCE((SELECT n FROM by_event WHERE action='profile_view'), 0),
    'lead_submits',         COALESCE((SELECT n FROM by_event WHERE action='lead_submit'), 0),
    'sponsor_refs',         (SELECT COUNT(*) FROM base WHERE sponsor_ref IS NOT NULL),
    'by_event',             COALESCE((SELECT jsonb_agg(jsonb_build_object('action',action,'n',n) ORDER BY n DESC) FROM by_event), '[]'::jsonb),
    'by_day',               COALESCE((SELECT jsonb_agg(jsonb_build_object('d',d,'n',n,'clicks',clicks,'profile_views',profile_views,'lead_submits',lead_submits)) FROM by_day), '[]'::jsonb),
    'top_source_paths',     COALESCE((SELECT jsonb_agg(jsonb_build_object('path',path,'clicks',clicks)) FROM top_source), '[]'::jsonb),
    'top_target_paths',     COALESCE((SELECT jsonb_agg(jsonb_build_object('path',path,'clicks',clicks)) FROM top_target), '[]'::jsonb),
    'top_landings',         COALESCE((SELECT jsonb_agg(jsonb_build_object('path',path,'views',views)) FROM top_landings), '[]'::jsonb),
    'ctr_by_landing',       COALESCE((SELECT jsonb_agg(jsonb_build_object('path',path,'views',views,'clicks',clicks,'ctr_pct',ctr_pct)) FROM ctr), '[]'::jsonb),
    'orphan_landings',      COALESCE((SELECT jsonb_agg(jsonb_build_object('path',path,'views',views)) FROM orphans), '[]'::jsonb),
    'recent_events',        COALESCE((SELECT jsonb_agg(jsonb_build_object('action',action,'created_at',created_at,'pathname',pathname,'target_path',target_path,'source',source,'sponsor_ref',sponsor_ref)) FROM recent), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_funnel_health(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_funnel_health(integer) TO authenticated;
