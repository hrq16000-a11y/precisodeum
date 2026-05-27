ALTER TABLE public.error_reports
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS release_channel text,
  ADD COLUMN IF NOT EXISTS build_id text;

CREATE INDEX IF NOT EXISTS idx_error_reports_app_version
  ON public.error_reports (app_version, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_reports_release_channel
  ON public.error_reports (release_channel, created_at DESC);

COMMENT ON COLUMN public.error_reports.app_version IS 'APP_VERSION do cliente no momento do erro — para correlacionar com deploys.';
COMMENT ON COLUMN public.error_reports.release_channel IS 'preview|production|dev|unknown — derivado do hostname.';
COMMENT ON COLUMN public.error_reports.build_id IS '__BUILD_TIMESTAMP__ injetado pelo Vite — identifica o build exato.';