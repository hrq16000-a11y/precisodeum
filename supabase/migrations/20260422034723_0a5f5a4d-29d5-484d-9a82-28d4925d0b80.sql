CREATE OR REPLACE FUNCTION public.log_provider_public_event(
  provider_id uuid,
  event_action text,
  page_path text DEFAULT NULL::text,
  service_name text DEFAULT NULL::text,
  source_marker text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner_id uuid;
  _source text;
BEGIN
  IF event_action NOT IN ('profile_view', 'whatsapp_click', 'phone_click') THEN
    RAISE EXCEPTION 'invalid event action';
  END IF;

  SELECT p.user_id INTO _owner_id
  FROM public.providers p
  WHERE p.id = provider_id
    AND p.status = 'approved'
    AND p.deleted_at IS NULL;

  IF _owner_id IS NULL THEN
    RETURN;
  END IF;

  _source := lower(coalesce(nullif(source_marker, ''), 'direto'));
  IF _source NOT IN ('direto', 'busca', 'categoria') THEN
    _source := 'direto';
  END IF;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    _owner_id,
    event_action,
    'provider',
    provider_id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'page_path', page_path,
      'source', _source,
      'service_name', nullif(service_name, ''),
      'visitor_authenticated', auth.uid() IS NOT NULL
    ))
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_lead_stats(provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner_id uuid;
  _start_date date := current_date - 29;
  _today date := current_date;
  _result jsonb;
  _top_services jsonb;
BEGIN
  SELECT p.user_id INTO _owner_id
  FROM public.providers p
  WHERE p.id = provider_id;

  IF _owner_id IS NULL THEN
    RETURN jsonb_build_object(
      'views', 0,
      'whatsapp_clicks', 0,
      'phone_clicks', 0,
      'top_services', '[]'::jsonb,
      'series', '[]'::jsonb
    );
  END IF;

  IF auth.uid() IS NULL OR (auth.uid() <> _owner_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  WITH ranked_services AS (
    SELECT
      COALESCE(NULLIF(al.details->>'service_name', ''), 'Perfil geral') AS service_name,
      count(*)::integer AS clicks
    FROM public.audit_log al
    WHERE al.resource_type = 'provider'
      AND al.resource_id = get_lead_stats.provider_id::text
      AND al.action IN ('whatsapp_click', 'phone_click')
      AND al.created_at >= _start_date::timestamptz
      AND al.created_at < (_today + 1)::timestamptz
    GROUP BY COALESCE(NULLIF(al.details->>'service_name', ''), 'Perfil geral')
    ORDER BY clicks DESC, service_name ASC
    LIMIT 3
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('service_name', service_name, 'clicks', clicks)), '[]'::jsonb)
  INTO _top_services
  FROM ranked_services;

  WITH days AS (
    SELECT generate_series(_start_date, _today, interval '1 day')::date AS day
  ),
  materialized AS (
    SELECT
      pds."date" AS day,
      sum(pds.views)::integer AS views,
      sum(pds.whatsapp_clicks)::integer AS whatsapp_clicks,
      sum(pds.phone_clicks)::integer AS phone_clicks
    FROM public.provider_daily_stats pds
    WHERE pds.provider_id = get_lead_stats.provider_id
      AND pds."date" >= _start_date
      AND pds."date" <= _today
    GROUP BY pds."date"
  ),
  today_raw AS (
    SELECT
      al.created_at::date AS day,
      count(*) FILTER (WHERE al.action = 'profile_view')::integer AS views,
      count(*) FILTER (WHERE al.action = 'whatsapp_click')::integer AS whatsapp_clicks,
      count(*) FILTER (WHERE al.action = 'phone_click')::integer AS phone_clicks
    FROM public.audit_log al
    WHERE al.resource_type = 'provider'
      AND al.resource_id = get_lead_stats.provider_id::text
      AND al.action IN ('profile_view', 'whatsapp_click', 'phone_click')
      AND al.created_at >= _today::timestamptz
      AND al.created_at < (_today + 1)::timestamptz
    GROUP BY al.created_at::date
  ),
  day_rows AS (
    SELECT
      d.day,
      (COALESCE(m.views, 0) + CASE WHEN d.day = _today THEN COALESCE(r.views, 0) ELSE 0 END)::integer AS views,
      (COALESCE(m.whatsapp_clicks, 0) + CASE WHEN d.day = _today THEN COALESCE(r.whatsapp_clicks, 0) ELSE 0 END)::integer AS whatsapp_clicks,
      (COALESCE(m.phone_clicks, 0) + CASE WHEN d.day = _today THEN COALESCE(r.phone_clicks, 0) ELSE 0 END)::integer AS phone_clicks
    FROM days d
    LEFT JOIN materialized m ON m.day = d.day
    LEFT JOIN today_raw r ON r.day = d.day
    ORDER BY d.day
  )
  SELECT jsonb_build_object(
    'views', COALESCE(sum(views), 0),
    'whatsapp_clicks', COALESCE(sum(whatsapp_clicks), 0),
    'phone_clicks', COALESCE(sum(phone_clicks), 0),
    'top_services', _top_services,
    'series', COALESCE(jsonb_agg(jsonb_build_object(
      'label', to_char(day, 'DD/MM'),
      'date', day,
      'views', views,
      'whatsapp_clicks', whatsapp_clicks,
      'phone_clicks', phone_clicks
    ) ORDER BY day), '[]'::jsonb)
  ) INTO _result
  FROM day_rows;

  RETURN _result;
END;
$function$;