CREATE OR REPLACE FUNCTION public.increment_provider_daily_stats_from_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _provider_id uuid;
  _event_date date;
BEGIN
  IF NEW.resource_type <> 'provider'
     OR NEW.action NOT IN ('profile_view', 'whatsapp_click', 'phone_click')
     OR NEW.resource_id IS NULL
     OR NEW.resource_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN NEW;
  END IF;

  _provider_id := NEW.resource_id::uuid;
  _event_date := NEW.created_at::date;

  IF NOT EXISTS (
    SELECT 1
    FROM public.providers p
    WHERE p.id = _provider_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.provider_daily_stats (
    provider_id,
    "date",
    views,
    whatsapp_clicks,
    phone_clicks
  ) VALUES (
    _provider_id,
    _event_date,
    CASE WHEN NEW.action = 'profile_view' THEN 1 ELSE 0 END,
    CASE WHEN NEW.action = 'whatsapp_click' THEN 1 ELSE 0 END,
    CASE WHEN NEW.action = 'phone_click' THEN 1 ELSE 0 END
  )
  ON CONFLICT (provider_id, "date")
  DO UPDATE SET
    views = provider_daily_stats.views + EXCLUDED.views,
    whatsapp_clicks = provider_daily_stats.whatsapp_clicks + EXCLUDED.whatsapp_clicks,
    phone_clicks = provider_daily_stats.phone_clicks + EXCLUDED.phone_clicks,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_increment_provider_daily_stats ON public.audit_log;
CREATE TRIGGER audit_log_increment_provider_daily_stats
AFTER INSERT ON public.audit_log
FOR EACH ROW
EXECUTE FUNCTION public.increment_provider_daily_stats_from_audit_log();