
-- ETAPA 2: Mover Materialized Views do schema público para schema interno.

-- 1. Schema interno
CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC;
GRANT USAGE ON SCHEMA internal TO service_role;

-- ========================================================================
-- 2. featured_providers_mv
-- ========================================================================
-- Dropar função dependente antes da MV
DROP FUNCTION IF EXISTS public.get_featured_providers(integer, text);

-- Criar MV no schema internal
CREATE MATERIALIZED VIEW IF NOT EXISTS internal.featured_providers_mv AS
SELECT p.id, p.user_id, p.user_ref, p.slug, p.business_name, p.description,
       p.photo_url, p.city, p.state, p.neighborhood, p.phone, p.whatsapp,
       p.latitude, p.longitude, p.years_experience, p.plan, p.featured,
       p.rating_avg, p.review_count, p.services_count, p.portfolio_album_count,
       p.portfolio_photo_count, p.created_at, p.category_id,
       c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
       COALESCE(p.account_type, 'autonomous'::text) AS account_type,
       p.business_segment, p.street, p.street_number, p.complement, p.postal_code,
       COALESCE(p.social_links, '{}'::jsonb) AS social_links,
       COALESCE(p.show_full_address, false) AS show_full_address
  FROM providers p
  LEFT JOIN categories c ON c.id = p.category_id
 WHERE p.status = 'approved' AND p.deleted_at IS NULL AND p.featured = true
 ORDER BY COALESCE(p.rating_avg, 0) DESC,
          COALESCE(p.review_count, 0) DESC,
          p.created_at DESC;

CREATE UNIQUE INDEX IF NOT EXISTS featured_providers_mv_id_idx
  ON internal.featured_providers_mv USING btree (id);
CREATE INDEX IF NOT EXISTS featured_providers_mv_account_type_idx
  ON internal.featured_providers_mv USING btree (account_type);

DROP MATERIALIZED VIEW IF EXISTS public.featured_providers_mv;

-- Recriar função pública com a mesma assinatura antiga, lendo da MV interna
CREATE OR REPLACE FUNCTION public.get_featured_providers(
  _limit integer DEFAULT 12,
  _account_type text DEFAULT NULL
)
RETURNS SETOF internal.featured_providers_mv
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, internal
AS $$
  SELECT * FROM internal.featured_providers_mv
   WHERE _account_type IS NULL OR account_type = _account_type
   ORDER BY rating_avg DESC NULLS LAST, review_count DESC NULLS LAST
   LIMIT _limit;
$$;

REVOKE ALL ON FUNCTION public.get_featured_providers(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_featured_providers(integer, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_featured_providers_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY internal.featured_providers_mv;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW internal.featured_providers_mv;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_featured_providers_mv() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_featured_providers_mv() TO service_role;

REFRESH MATERIALIZED VIEW internal.featured_providers_mv;

-- ========================================================================
-- 3. web_vitals_weekly_summary
-- ========================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS internal.web_vitals_weekly_summary AS
SELECT (date_trunc('day', created_at))::date AS day,
       COALESCE(metric, 'unknown') AS metric,
       COALESCE(route, '/') AS route,
       count(*)::integer AS samples,
       avg(value)::numeric(12,3) AS avg_value,
       (percentile_cont(0.75) WITHIN GROUP (ORDER BY value::double precision))::numeric(12,3) AS p75_value,
       (percentile_cont(0.95) WITHIN GROUP (ORDER BY value::double precision))::numeric(12,3) AS p95_value
  FROM public.web_vitals_log
 WHERE created_at > (now() - interval '90 days')
 GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_web_vitals_weekly_uniq
  ON internal.web_vitals_weekly_summary USING btree (day, metric, route);

DROP MATERIALIZED VIEW IF EXISTS public.web_vitals_weekly_summary;

-- RPC admin-only para leitura
CREATE OR REPLACE FUNCTION public.get_web_vitals_weekly_summary(_days integer DEFAULT 30)
RETURNS SETOF internal.web_vitals_weekly_summary
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, internal
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT * FROM internal.web_vitals_weekly_summary
     WHERE day >= (current_date - GREATEST(_days, 1))
     ORDER BY day DESC, metric, route;
END;
$$;

REVOKE ALL ON FUNCTION public.get_web_vitals_weekly_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_web_vitals_weekly_summary(integer) TO authenticated, service_role;

-- Atualiza purge_telemetry_tables para referenciar a nova MV
CREATE OR REPLACE FUNCTION public.purge_telemetry_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
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
    REFRESH MATERIALIZED VIEW CONCURRENTLY internal.web_vitals_weekly_summary;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW internal.web_vitals_weekly_summary;
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

REFRESH MATERIALIZED VIEW internal.web_vitals_weekly_summary;
