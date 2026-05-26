INSERT INTO public.site_settings (key, value, updated_at)
VALUES ('onboarding_regression_watch_enabled', 'false'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.detect_onboarding_regressions(
  _window_minutes int DEFAULT 60,
  _baseline_days int DEFAULT 7,
  _debounce_hours int DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now              timestamptz := now();
  v_window_start     timestamptz := now() - (_window_minutes * interval '1 minute');
  v_baseline_start   timestamptz := now() - (_baseline_days * interval '1 day');
  v_debounce_start   timestamptz := now() - (_debounce_hours * interval '1 hour');
  v_inserted         int := 0;
  v_anomalies        jsonb := '[]'::jsonb;
  v_app_version_curr text;
  v_release_curr     text;
  rec                record;
  v_severity         text;
  v_delta            numeric;
  v_already          int;
BEGIN
  CREATE TEMP TABLE _metric_defs ON COMMIT DROP AS
  SELECT * FROM (VALUES
    ('validation_failed_rate',      true,  30, 150, 0.08::numeric, 0.15::numeric, 0.30::numeric, false),
    ('autosave_remote_failed_rate', true,  30, 150, 0.05::numeric, 0.10::numeric, 0.20::numeric, false),
    ('refresh_rate',                true,  30, 150, 0.08::numeric, 0.15::numeric, 0.30::numeric, false),
    ('concurrent_tab_rate',         true,  20, 100, 0.05::numeric, 0.10::numeric, 0.20::numeric, false),
    ('recovery_discarded_rate',     true,  5,  30,  0.05::numeric, 0.10::numeric, 0.20::numeric, false),
    ('first_service_persist_rate',  false, 15, 75,  0.05::numeric, 0.10::numeric, 0.20::numeric, false),
    ('completion_rate',             false, 20, 100, 0.08::numeric, 0.15::numeric, 0.30::numeric, false),
    ('avg_phase_duration_ms',       true,  30, 150, 0.30::numeric, 0.60::numeric, 1.00::numeric, true )
  ) AS t(metric, higher_is_worse, min_cur, min_base, t_medium, t_high, t_critical, is_duration);

  CREATE TEMP TABLE _samples (
    metric text PRIMARY KEY,
    cur_value numeric, cur_sample int,
    base_value numeric, base_sample int
  ) ON COMMIT DROP;

  -- validation_failed_rate
  INSERT INTO _samples
  SELECT 'validation_failed_rate',
    COALESCE(SUM(CASE WHEN o.created_at >= v_window_start AND o.event='error' AND (o.meta->>'kind') ILIKE 'validation%' THEN 1 END), 0)::numeric
      / NULLIF(COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start AND o.event='enter' THEN o.session_id END), 0),
    COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start AND o.event='enter' THEN o.session_id END),
    COALESCE(SUM(CASE WHEN o.created_at < v_window_start AND o.event='error' AND (o.meta->>'kind') ILIKE 'validation%' THEN 1 END), 0)::numeric
      / NULLIF(COUNT(DISTINCT CASE WHEN o.created_at < v_window_start AND o.event='enter' THEN o.session_id END), 0),
    COUNT(DISTINCT CASE WHEN o.created_at < v_window_start AND o.event='enter' THEN o.session_id END)
  FROM public.onboarding_events o
  WHERE o.created_at >= v_baseline_start;

  -- autosave_remote_failed_rate
  INSERT INTO _samples
  SELECT 'autosave_remote_failed_rate',
    COALESCE(SUM(CASE WHEN o.created_at >= v_window_start AND (o.meta->>'kind') IN ('autosave_remote_failed','autosave_remote_retry_failed') THEN 1 END), 0)::numeric
      / NULLIF(COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start THEN o.session_id END), 0),
    COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start THEN o.session_id END),
    COALESCE(SUM(CASE WHEN o.created_at < v_window_start AND (o.meta->>'kind') IN ('autosave_remote_failed','autosave_remote_retry_failed') THEN 1 END), 0)::numeric
      / NULLIF(COUNT(DISTINCT CASE WHEN o.created_at < v_window_start THEN o.session_id END), 0),
    COUNT(DISTINCT CASE WHEN o.created_at < v_window_start THEN o.session_id END)
  FROM public.onboarding_events o
  WHERE o.created_at >= v_baseline_start;

  -- refresh_rate
  INSERT INTO _samples
  SELECT 'refresh_rate',
    COALESCE(SUM(CASE WHEN o.created_at >= v_window_start AND (o.meta->>'kind') = 'refresh_detected' THEN 1 END), 0)::numeric
      / NULLIF(COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start THEN o.session_id END), 0),
    COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start THEN o.session_id END),
    COALESCE(SUM(CASE WHEN o.created_at < v_window_start AND (o.meta->>'kind') = 'refresh_detected' THEN 1 END), 0)::numeric
      / NULLIF(COUNT(DISTINCT CASE WHEN o.created_at < v_window_start THEN o.session_id END), 0),
    COUNT(DISTINCT CASE WHEN o.created_at < v_window_start THEN o.session_id END)
  FROM public.onboarding_events o
  WHERE o.created_at >= v_baseline_start;

  -- concurrent_tab_rate
  INSERT INTO _samples
  SELECT 'concurrent_tab_rate',
    COALESCE(SUM(CASE WHEN o.created_at >= v_window_start AND (o.meta->>'kind') = 'concurrent_tab_detected' THEN 1 END), 0)::numeric
      / NULLIF(COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start THEN o.session_id END), 0),
    COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start THEN o.session_id END),
    COALESCE(SUM(CASE WHEN o.created_at < v_window_start AND (o.meta->>'kind') = 'concurrent_tab_detected' THEN 1 END), 0)::numeric
      / NULLIF(COUNT(DISTINCT CASE WHEN o.created_at < v_window_start THEN o.session_id END), 0),
    COUNT(DISTINCT CASE WHEN o.created_at < v_window_start THEN o.session_id END)
  FROM public.onboarding_events o
  WHERE o.created_at >= v_baseline_start;

  -- recovery_discarded_rate
  INSERT INTO _samples
  SELECT 'recovery_discarded_rate',
    COALESCE(SUM(CASE WHEN o.created_at >= v_window_start AND ((o.meta->>'kind') ILIKE '%recovery%discard%' OR (o.meta->>'kind') ILIKE '%checksum_invalid%') THEN 1 END), 0)::numeric
      / NULLIF(COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start THEN o.session_id END), 0),
    COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start THEN o.session_id END),
    COALESCE(SUM(CASE WHEN o.created_at < v_window_start AND ((o.meta->>'kind') ILIKE '%recovery%discard%' OR (o.meta->>'kind') ILIKE '%checksum_invalid%') THEN 1 END), 0)::numeric
      / NULLIF(COUNT(DISTINCT CASE WHEN o.created_at < v_window_start THEN o.session_id END), 0),
    COUNT(DISTINCT CASE WHEN o.created_at < v_window_start THEN o.session_id END)
  FROM public.onboarding_events o
  WHERE o.created_at >= v_baseline_start;

  -- first_service_persist_rate
  INSERT INTO _samples
  SELECT 'first_service_persist_rate',
    COALESCE(SUM(CASE WHEN o.created_at >= v_window_start AND (o.meta->>'kind') IN ('persist_first_service_early_ok','persist_first_service_early_reused','reused_service_details_synced') THEN 1 END), 0)::numeric
      / NULLIF(SUM(CASE WHEN o.created_at >= v_window_start AND (o.meta->>'kind') ILIKE 'persist_first_service%' THEN 1 END), 0),
    COALESCE(SUM(CASE WHEN o.created_at >= v_window_start AND (o.meta->>'kind') ILIKE 'persist_first_service%' THEN 1 END), 0)::int,
    COALESCE(SUM(CASE WHEN o.created_at < v_window_start AND (o.meta->>'kind') IN ('persist_first_service_early_ok','persist_first_service_early_reused','reused_service_details_synced') THEN 1 END), 0)::numeric
      / NULLIF(SUM(CASE WHEN o.created_at < v_window_start AND (o.meta->>'kind') ILIKE 'persist_first_service%' THEN 1 END), 0),
    COALESCE(SUM(CASE WHEN o.created_at < v_window_start AND (o.meta->>'kind') ILIKE 'persist_first_service%' THEN 1 END), 0)::int
  FROM public.onboarding_events o
  WHERE o.created_at >= v_baseline_start;

  -- completion_rate
  INSERT INTO _samples
  SELECT 'completion_rate',
    COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start AND o.event='complete' THEN o.session_id END)::numeric
      / NULLIF(COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start AND o.event='enter' THEN o.session_id END), 0),
    COUNT(DISTINCT CASE WHEN o.created_at >= v_window_start AND o.event='enter' THEN o.session_id END),
    COUNT(DISTINCT CASE WHEN o.created_at < v_window_start AND o.event='complete' THEN o.session_id END)::numeric
      / NULLIF(COUNT(DISTINCT CASE WHEN o.created_at < v_window_start AND o.event='enter' THEN o.session_id END), 0),
    COUNT(DISTINCT CASE WHEN o.created_at < v_window_start AND o.event='enter' THEN o.session_id END)
  FROM public.onboarding_events o
  WHERE o.created_at >= v_baseline_start;

  -- avg_phase_duration_ms
  INSERT INTO _samples
  SELECT 'avg_phase_duration_ms',
    AVG(CASE WHEN o.created_at >= v_window_start AND o.event='phase_exit' THEN ((o.meta->>'duration_ms')::numeric) END),
    COUNT(CASE WHEN o.created_at >= v_window_start AND o.event='phase_exit' THEN 1 END)::int,
    AVG(CASE WHEN o.created_at < v_window_start AND o.event='phase_exit' THEN ((o.meta->>'duration_ms')::numeric) END),
    COUNT(CASE WHEN o.created_at < v_window_start AND o.event='phase_exit' THEN 1 END)::int
  FROM public.onboarding_events o
  WHERE o.created_at >= v_baseline_start;

  SELECT (o.meta->>'app_version'), (o.meta->>'release_channel')
    INTO v_app_version_curr, v_release_curr
  FROM public.onboarding_events o
  WHERE o.created_at >= v_window_start
    AND (o.meta ? 'app_version')
  GROUP BY 1, 2
  ORDER BY count(*) DESC
  LIMIT 1;

  FOR rec IN SELECT s.*, d.higher_is_worse, d.min_cur, d.min_base, d.t_medium, d.t_high, d.t_critical, d.is_duration
             FROM _samples s
             JOIN _metric_defs d ON d.metric = s.metric
  LOOP
    IF rec.cur_sample IS NULL OR rec.cur_sample < rec.min_cur THEN CONTINUE; END IF;
    IF rec.base_sample IS NULL OR rec.base_sample < rec.min_base THEN CONTINUE; END IF;
    IF rec.cur_value IS NULL OR rec.base_value IS NULL THEN CONTINUE; END IF;

    IF rec.is_duration THEN
      v_delta := (rec.cur_value - rec.base_value) / NULLIF(rec.base_value, 0);
      IF NOT rec.higher_is_worse THEN v_delta := -v_delta; END IF;
    ELSIF rec.higher_is_worse THEN
      v_delta := rec.cur_value - rec.base_value;
    ELSE
      v_delta := rec.base_value - rec.cur_value;
    END IF;

    IF v_delta IS NULL OR v_delta <= 0 THEN CONTINUE; END IF;

    IF v_delta >= rec.t_critical THEN v_severity := 'critical';
    ELSIF v_delta >= rec.t_high THEN v_severity := 'high';
    ELSIF v_delta >= rec.t_medium THEN v_severity := 'medium';
    ELSIF v_delta >= rec.t_medium * 0.5 THEN v_severity := 'low';
    ELSE CONTINUE; END IF;

    SELECT count(*) INTO v_already
    FROM public.onboarding_events o
    WHERE o.event = 'onboarding_regression_detected'
      AND o.created_at >= v_debounce_start
      AND (o.meta->>'metric') = rec.metric
      AND CASE (o.meta->>'severity')
            WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0
          END
          >=
          CASE v_severity
            WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0
          END;

    IF v_already > 0 THEN CONTINUE; END IF;

    INSERT INTO public.onboarding_events (user_id, session_id, variant, phase, event, meta)
    VALUES (
      NULL,
      'regression-watch',
      'detector',
      'system',
      'onboarding_regression_detected',
      jsonb_build_object(
        'metric',         rec.metric,
        'severity',       v_severity,
        'delta',          v_delta,
        'current',        rec.cur_value,
        'baseline',       rec.base_value,
        'sample_current', rec.cur_sample,
        'sample_baseline', rec.base_sample,
        'window_minutes', _window_minutes,
        'baseline_days',  _baseline_days,
        'app_version',    v_app_version_curr,
        'release_channel', v_release_curr,
        'detected_at',    v_now
      )
    );
    v_inserted := v_inserted + 1;
    v_anomalies := v_anomalies || jsonb_build_object(
      'metric', rec.metric, 'severity', v_severity, 'delta', v_delta,
      'current', rec.cur_value, 'baseline', rec.base_value
    );
  END LOOP;

  RETURN jsonb_build_object(
    'inserted',      v_inserted,
    'anomalies',     v_anomalies,
    'window_minutes', _window_minutes,
    'baseline_days', _baseline_days,
    'app_version',   v_app_version_curr,
    'release_channel', v_release_curr,
    'evaluated_at',  v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.detect_onboarding_regressions(int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_onboarding_regressions(int, int, int) TO service_role;

DO $unschedule$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='onboarding-regression-watch';
EXCEPTION WHEN OTHERS THEN NULL;
END
$unschedule$;

SELECT cron.schedule(
  'onboarding-regression-watch',
  '*/15 * * * *',
  $cron$
    SELECT CASE
      WHEN COALESCE((SELECT (value)::text::boolean FROM public.site_settings WHERE key='onboarding_regression_watch_enabled'), false)
      THEN public.detect_onboarding_regressions(60, 7, 6)
      ELSE NULL::jsonb
    END;
  $cron$
);
