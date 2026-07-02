CREATE TABLE IF NOT EXISTS public.provider_daily_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  "date" date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  whatsapp_clicks integer NOT NULL DEFAULT 0,
  phone_clicks integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT provider_daily_stats_non_negative_counts CHECK (
    views >= 0 AND whatsapp_clicks >= 0 AND phone_clicks >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_daily_stats_provider_date_uidx
ON public.provider_daily_stats (provider_id, "date");

CREATE INDEX IF NOT EXISTS provider_daily_stats_date_idx
ON public.provider_daily_stats ("date");

ALTER TABLE public.provider_daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Provider owners can view their daily stats" ON public.provider_daily_stats;
CREATE POLICY "Provider owners can view their daily stats"
ON public.provider_daily_stats
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.providers p
    WHERE p.id = provider_daily_stats.provider_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can view all provider daily stats" ON public.provider_daily_stats;
CREATE POLICY "Admins can view all provider daily stats"
ON public.provider_daily_stats
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_provider_daily_stats_updated_at ON public.provider_daily_stats;
CREATE TRIGGER update_provider_daily_stats_updated_at
BEFORE UPDATE ON public.provider_daily_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

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

REVOKE ALL ON FUNCTION public.process_daily_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_daily_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_lead_stats(provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner_id uuid;
  _start_date date := current_date - 29;
  _today date := current_date;
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