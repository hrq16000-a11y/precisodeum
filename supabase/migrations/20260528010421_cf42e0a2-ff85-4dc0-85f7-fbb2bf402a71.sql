
INSERT INTO public.site_settings (key, value, description)
VALUES
  ('telemetry_sample_rate_web_vitals', to_jsonb(0.10::numeric), 'Taxa de amostragem (0..1) para envio de web_vitals_log do cliente'),
  ('telemetry_sample_rate_query', to_jsonb(0.05::numeric), 'Taxa de amostragem (0..1) para envio de query_telemetry'),
  ('telemetry_ttl_enabled', to_jsonb(true), 'Liga/desliga o cron de purge das tabelas de telemetria'),
  ('telemetry_ttl_last_run', 'null'::jsonb, 'Último timestamp de execução do purge_telemetry_tables (ISO).')
ON CONFLICT (key) DO NOTHING;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.web_vitals_weekly_summary AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COALESCE(metric, 'unknown') AS metric,
  COALESCE(route, '/') AS route,
  count(*)::int AS samples,
  avg(value)::numeric(12,3) AS avg_value,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::numeric(12,3) AS p75_value,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY value)::numeric(12,3) AS p95_value
FROM public.web_vitals_log
WHERE created_at > now() - interval '90 days'
GROUP BY 1,2,3
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_web_vitals_weekly_uniq
  ON public.web_vitals_weekly_summary(day, metric, route);

GRANT SELECT ON public.web_vitals_weekly_summary TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.purge_telemetry_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_enabled boolean;
  v_result jsonb := '{}'::jsonb;
  v_count bigint;
BEGIN
  SELECT COALESCE((value)::text::boolean, true) INTO v_enabled
    FROM public.site_settings WHERE key = 'telemetry_ttl_enabled';
  IF NOT COALESCE(v_enabled, true) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'disabled');
  END IF;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.web_vitals_weekly_summary;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.web_vitals_weekly_summary;
  END;

  DELETE FROM public.web_vitals_log WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('web_vitals_log', v_count);

  DELETE FROM public.sponsor_metrics WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('sponsor_metrics', v_count);

  DELETE FROM public.auth_profile_metrics WHERE recorded_at < now() - interval '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('auth_profile_metrics', v_count);

  DELETE FROM public.rls_policy_snapshots WHERE captured_at < now() - interval '14 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('rls_policy_snapshots', v_count);

  DELETE FROM public.query_telemetry WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('query_telemetry', v_count);

  DELETE FROM public.performance_reports WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('performance_reports', v_count);

  DELETE FROM public.user_access_logs WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('user_access_logs', v_count);

  DELETE FROM public.health_check_history WHERE created_at < now() - interval '14 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('health_check_history', v_count);

  DELETE FROM public.error_page_events WHERE occurred_at < now() - interval '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('error_page_events', v_count);

  INSERT INTO public.site_settings (key, value, description)
  VALUES ('telemetry_ttl_last_run', to_jsonb(now()::text), 'Última execução do purge')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN v_result || jsonb_build_object('finished_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.purge_telemetry_tables() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_telemetry_tables() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_telemetry_daily') THEN
    PERFORM cron.unschedule('purge_telemetry_daily');
  END IF;
END$$;

SELECT cron.schedule(
  'purge_telemetry_daily',
  '0 6 * * *',
  $$ SELECT public.purge_telemetry_tables(); $$
);
