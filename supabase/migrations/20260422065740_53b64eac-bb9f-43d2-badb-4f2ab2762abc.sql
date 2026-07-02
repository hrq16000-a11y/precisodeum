DROP POLICY IF EXISTS "Anyone can create anonymous performance reports" ON public.performance_reports;

CREATE POLICY "Anyone can create bounded performance reports"
ON public.performance_reports
FOR INSERT
WITH CHECK (
  route IS NOT NULL
  AND length(route) BETWEEN 1 AND 512
  AND navigation_type IN ('navigate', 'reload', 'back_forward', 'prerender', 'unknown')
  AND jsonb_typeof(vitals) = 'object'
  AND jsonb_typeof(resources) = 'object'
  AND jsonb_typeof(backend) = 'object'
  AND jsonb_typeof(bottlenecks) = 'array'
  AND pg_column_size(vitals) <= 8192
  AND pg_column_size(resources) <= 16384
  AND pg_column_size(backend) <= 8192
  AND pg_column_size(bottlenecks) <= 8192
  AND (user_agent IS NULL OR length(user_agent) <= 512)
  AND (viewport IS NULL OR length(viewport) <= 64)
  AND (connection_type IS NULL OR length(connection_type) <= 64)
);