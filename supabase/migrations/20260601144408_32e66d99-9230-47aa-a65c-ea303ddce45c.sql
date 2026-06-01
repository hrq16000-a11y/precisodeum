CREATE TABLE IF NOT EXISTS public.gsc_audit_log (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  site TEXT,
  sitemap TEXT,
  status INTEGER,
  ok BOOLEAN NOT NULL DEFAULT false,
  response JSONB,
  error TEXT,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsc_audit_log_created_at ON public.gsc_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_audit_log_action ON public.gsc_audit_log (action, created_at DESC);

GRANT SELECT ON public.gsc_audit_log TO authenticated;
GRANT ALL ON public.gsc_audit_log TO service_role;

ALTER TABLE public.gsc_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read gsc audit"
  ON public.gsc_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
