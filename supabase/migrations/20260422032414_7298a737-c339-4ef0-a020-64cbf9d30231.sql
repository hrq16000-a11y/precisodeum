CREATE OR REPLACE FUNCTION public.process_daily_stats()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target_date date := (current_date - 1);
  _processed integer := 0;
BEGIN
  INSERT INTO public.provider_daily_stats (
    provider_id,
    "date",
    views,
    whatsapp_clicks,
    phone_clicks
  )
  SELECT
    al.resource_id::uuid AS provider_id,
    _target_date AS "date",
    count(*) FILTER (WHERE al.action = 'profile_view')::integer AS views,
    count(*) FILTER (WHERE al.action = 'whatsapp_click')::integer AS whatsapp_clicks,
    count(*) FILTER (WHERE al.action = 'phone_click')::integer AS phone_clicks
  FROM public.audit_log al
  INNER JOIN public.providers p ON p.id = al.resource_id::uuid
  WHERE al.resource_type = 'provider'
    AND al.action IN ('profile_view', 'whatsapp_click', 'phone_click')
    AND al.resource_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND al.created_at >= _target_date::timestamptz
    AND al.created_at < (_target_date + 1)::timestamptz
  GROUP BY al.resource_id::uuid
  ON CONFLICT (provider_id, "date")
  DO UPDATE SET
    views = EXCLUDED.views,
    whatsapp_clicks = EXCLUDED.whatsapp_clicks,
    phone_clicks = EXCLUDED.phone_clicks,
    updated_at = now();

  GET DIAGNOSTICS _processed = ROW_COUNT;
  RETURN _processed;
END;
$$;