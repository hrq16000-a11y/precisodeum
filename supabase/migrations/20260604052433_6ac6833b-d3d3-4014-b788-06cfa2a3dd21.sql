
CREATE TABLE public.web_vitals_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL CHECK (metric IN ('LCP','INP','CLS','TTFB','FCP')),
  value numeric NOT NULL,
  rating text CHECK (rating IN ('good','needs-improvement','poor')),
  route text NOT NULL,
  navigation_type text,
  device text,
  connection text,
  app_version text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.web_vitals_samples TO anon, authenticated;
GRANT SELECT ON public.web_vitals_samples TO service_role;
GRANT ALL ON public.web_vitals_samples TO service_role;

ALTER TABLE public.web_vitals_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_insert_web_vitals"
  ON public.web_vitals_samples FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(route) <= 300
    AND char_length(coalesce(navigation_type,'')) <= 40
    AND char_length(coalesce(device,'')) <= 40
    AND char_length(coalesce(connection,'')) <= 40
    AND char_length(coalesce(app_version,'')) <= 40
    AND value >= 0 AND value <= 600000
  );

CREATE POLICY "admins_select_web_vitals"
  ON public.web_vitals_samples FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_web_vitals_route_metric_created
  ON public.web_vitals_samples (route, metric, created_at DESC);

CREATE INDEX idx_web_vitals_created_at
  ON public.web_vitals_samples (created_at DESC);

-- Retenção: mantém 30 dias
CREATE OR REPLACE FUNCTION public.cleanup_web_vitals_samples()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.web_vitals_samples WHERE created_at < now() - interval '30 days';
$$;

-- RPC: p75 por rota+metric nas últimas N horas
CREATE OR REPLACE FUNCTION public.get_web_vitals_p75(_hours integer DEFAULT 24)
RETURNS TABLE(
  route text,
  metric text,
  p75 numeric,
  p95 numeric,
  samples bigint,
  poor_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    route,
    metric,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::numeric AS p75,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY value)::numeric AS p95,
    count(*) AS samples,
    count(*) FILTER (WHERE rating = 'poor') AS poor_count
  FROM public.web_vitals_samples
  WHERE created_at > now() - make_interval(hours => greatest(_hours, 1))
    AND public.has_role(auth.uid(), 'admin')
  GROUP BY route, metric
  HAVING count(*) >= 5
  ORDER BY metric, p75 DESC;
$$;

REVOKE ALL ON FUNCTION public.get_web_vitals_p75(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_web_vitals_p75(integer) TO authenticated;

-- RPC: alertas — p75 LCP > 2500ms ou p75 INP > 500ms sustentado
CREATE OR REPLACE FUNCTION public.get_web_vitals_alerts(_hours integer DEFAULT 1)
RETURNS TABLE(
  route text,
  metric text,
  p75 numeric,
  samples bigint,
  threshold numeric,
  severity text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      route,
      metric,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::numeric AS p75,
      count(*) AS samples
    FROM public.web_vitals_samples
    WHERE created_at > now() - make_interval(hours => greatest(_hours, 1))
      AND public.has_role(auth.uid(), 'admin')
    GROUP BY route, metric
    HAVING count(*) >= 10
  )
  SELECT
    route, metric, p75, samples,
    CASE metric
      WHEN 'LCP' THEN 2500
      WHEN 'INP' THEN 500
      WHEN 'CLS' THEN 0.25
      WHEN 'FCP' THEN 3000
      WHEN 'TTFB' THEN 1800
    END::numeric AS threshold,
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
  WHERE
    (metric='LCP' AND p75 > 2500)
    OR (metric='INP' AND p75 > 500)
    OR (metric='CLS' AND p75 > 0.25)
    OR (metric='FCP' AND p75 > 3000)
    OR (metric='TTFB' AND p75 > 1800)
  ORDER BY severity DESC, p75 DESC;
$$;

REVOKE ALL ON FUNCTION public.get_web_vitals_alerts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_web_vitals_alerts(integer) TO authenticated;

-- Cron: limpeza diária às 04:00 UTC
SELECT cron.schedule(
  'cleanup-web-vitals-samples',
  '0 4 * * *',
  $$SELECT public.cleanup_web_vitals_samples();$$
);
