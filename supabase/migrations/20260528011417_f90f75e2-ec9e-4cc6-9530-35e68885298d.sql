CREATE OR REPLACE FUNCTION public.purge_telemetry_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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

  DELETE FROM public.auth_profile_metrics WHERE recorded_at < now() - interval '14 days';
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
$function$;