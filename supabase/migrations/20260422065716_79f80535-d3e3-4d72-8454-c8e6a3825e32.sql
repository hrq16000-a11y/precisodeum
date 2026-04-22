CREATE TABLE IF NOT EXISTS public.performance_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NULL,
  route TEXT NOT NULL DEFAULT '/',
  navigation_type TEXT NOT NULL DEFAULT 'navigate',
  vitals JSONB NOT NULL DEFAULT '{}'::jsonb,
  resources JSONB NOT NULL DEFAULT '{}'::jsonb,
  backend JSONB NOT NULL DEFAULT '{}'::jsonb,
  bottlenecks JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_agent TEXT NULL,
  viewport TEXT NULL,
  connection_type TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create anonymous performance reports"
ON public.performance_reports
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view performance reports"
ON public.performance_reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete performance reports"
ON public.performance_reports
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_performance_reports_created_at
ON public.performance_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_reports_route_created_at
ON public.performance_reports (route, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_reports_lcp
ON public.performance_reports (((vitals->>'lcp')::numeric))
WHERE vitals ? 'lcp';