CREATE TABLE IF NOT EXISTS public.seo_audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  total_urls integer NOT NULL DEFAULT 0,
  ok_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  robots_ok boolean NOT NULL DEFAULT true,
  robots_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  sitemap_url text,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_ms integer,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_seo_audit_reports_ran_at ON public.seo_audit_reports(ran_at DESC);

ALTER TABLE public.seo_audit_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read seo audit reports" ON public.seo_audit_reports;
CREATE POLICY "admins read seo audit reports"
  ON public.seo_audit_reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins insert seo audit reports" ON public.seo_audit_reports;
CREATE POLICY "admins insert seo audit reports"
  ON public.seo_audit_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND (triggered_by = auth.uid() OR triggered_by IS NULL));