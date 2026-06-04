
-- Remove cron e tabela duplicada
SELECT cron.unschedule('cleanup-web-vitals-samples');
DROP FUNCTION IF EXISTS public.cleanup_web_vitals_samples();
DROP FUNCTION IF EXISTS public.get_web_vitals_p75(integer);
DROP FUNCTION IF EXISTS public.get_web_vitals_alerts(integer);
DROP TABLE IF EXISTS public.web_vitals_samples;

-- Recria RPCs apontando para a tabela existente web_vitals_log
CREATE OR REPLACE FUNCTION public.get_web_vitals_p75(_hours integer DEFAULT 24)
RETURNS TABLE(route text, metric text, p75 numeric, p95 numeric, samples bigint, poor_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    route, metric,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::numeric AS p75,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY value)::numeric AS p95,
    count(*) AS samples,
    count(*) FILTER (WHERE rating = 'poor') AS poor_count
  FROM public.web_vitals_log
  WHERE created_at > now() - make_interval(hours => greatest(_hours, 1))
  GROUP BY route, metric
  HAVING count(*) >= 5
  ORDER BY metric, p75 DESC;
$$;
REVOKE ALL ON FUNCTION public.get_web_vitals_p75(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_web_vitals_p75(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_web_vitals_alerts(_hours integer DEFAULT 1)
RETURNS TABLE(route text, metric text, p75 numeric, samples bigint, threshold numeric, severity text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT route, metric,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::numeric AS p75,
      count(*) AS samples
    FROM public.web_vitals_log
    WHERE created_at > now() - make_interval(hours => greatest(_hours, 1))
    GROUP BY route, metric
    HAVING count(*) >= 10
  )
  SELECT route, metric, p75, samples,
    CASE metric WHEN 'LCP' THEN 2500 WHEN 'INP' THEN 500 WHEN 'CLS' THEN 0.25
                WHEN 'FCP' THEN 3000 WHEN 'TTFB' THEN 1800 END::numeric AS threshold,
    CASE
      WHEN metric='LCP' AND p75 > 4000 THEN 'critical'
      WHEN metric='LCP' AND p75 > 2500 THEN 'warning'
      WHEN metric='INP' AND p75 > 1000 THEN 'critical'
      WHEN metric='INP' AND p75 > 500 THEN 'warning'
      WHEN metric='CLS' AND p75 > 0.5 THEN 'critical'
      WHEN metric='CLS' AND p75 > 0.25 THEN 'warning'
      ELSE 'ok'
    END AS severity
  FROM agg
  WHERE (metric='LCP' AND p75 > 2500)
     OR (metric='INP' AND p75 > 500)
     OR (metric='CLS' AND p75 > 0.25)
     OR (metric='FCP' AND p75 > 3000)
     OR (metric='TTFB' AND p75 > 1800)
  ORDER BY severity DESC, p75 DESC;
$$;
REVOKE ALL ON FUNCTION public.get_web_vitals_alerts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_web_vitals_alerts(integer) TO authenticated;
