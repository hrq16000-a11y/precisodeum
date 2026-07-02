CREATE OR REPLACE FUNCTION public.get_lead_stats(provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _since timestamptz := now() - interval '30 days';
  _result jsonb;
BEGIN
  SELECT p.user_id INTO _owner_id
  FROM public.providers p
  WHERE p.id = provider_id;

  IF _owner_id IS NULL THEN
    RETURN jsonb_build_object(
      'views', 0,
      'whatsapp_clicks', 0,
      'phone_clicks', 0,
      'series', '[]'::jsonb
    );
  END IF;

  IF auth.uid() IS NULL OR (auth.uid() <> _owner_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  WITH days AS (
    SELECT generate_series(
      date_trunc('day', now()) - interval '29 days',
      date_trunc('day', now()),
      interval '1 day'
    )::date AS day
  ),
  events AS (
    SELECT
      created_at::date AS day,
      action,
      count(*)::int AS total
    FROM public.audit_log
    WHERE resource_type = 'provider'
      AND resource_id = provider_id::text
      AND action IN ('profile_view', 'whatsapp_click', 'phone_click')
      AND created_at >= _since
    GROUP BY created_at::date, action
  ),
  day_rows AS (
    SELECT
      d.day,
      COALESCE(sum(e.total) FILTER (WHERE e.action = 'profile_view'), 0)::int AS views,
      COALESCE(sum(e.total) FILTER (WHERE e.action = 'whatsapp_click'), 0)::int AS whatsapp_clicks,
      COALESCE(sum(e.total) FILTER (WHERE e.action = 'phone_click'), 0)::int AS phone_clicks
    FROM days d
    LEFT JOIN events e ON e.day = d.day
    GROUP BY d.day
    ORDER BY d.day
  )
  SELECT jsonb_build_object(
    'views', COALESCE(sum(views), 0),
    'whatsapp_clicks', COALESCE(sum(whatsapp_clicks), 0),
    'phone_clicks', COALESCE(sum(phone_clicks), 0),
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
$$;

GRANT EXECUTE ON FUNCTION public.get_lead_stats(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_audit_log_provider_lead_stats
ON public.audit_log (resource_type, resource_id, action, created_at DESC)
WHERE resource_type = 'provider' AND action IN ('profile_view', 'whatsapp_click', 'phone_click');