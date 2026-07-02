CREATE TABLE IF NOT EXISTS public.web_vitals_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  metric text NOT NULL CHECK (metric IN ('LCP','INP','CLS','FCP','TTFB')),
  value numeric NOT NULL,
  rating text CHECK (rating IN ('good','needs-improvement','poor')),
  navigation_type text,
  connection_type text,
  device_pixel_ratio numeric,
  viewport text,
  user_agent text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_vitals_route_created ON public.web_vitals_log (route, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_vitals_metric_created ON public.web_vitals_log (metric, created_at DESC);

ALTER TABLE public.web_vitals_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert web vitals"
  ON public.web_vitals_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admins can read web vitals"
  ON public.web_vitals_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));