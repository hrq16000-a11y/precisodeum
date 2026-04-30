ALTER TABLE public.lead_alert_preferences
  ADD COLUMN IF NOT EXISTS min_interval_seconds integer NOT NULL DEFAULT 0;

ALTER TABLE public.lead_alert_preferences
  DROP CONSTRAINT IF EXISTS lead_alert_preferences_min_interval_check;

ALTER TABLE public.lead_alert_preferences
  ADD CONSTRAINT lead_alert_preferences_min_interval_check
  CHECK (min_interval_seconds >= 0 AND min_interval_seconds <= 3600);