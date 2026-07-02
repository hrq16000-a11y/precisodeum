ALTER TABLE public.upload_test_results
  ADD COLUMN IF NOT EXISTS stage TEXT,
  ADD COLUMN IF NOT EXISTS stage_latency_ms INT,
  ADD COLUMN IF NOT EXISTS fallback_level INT;

CREATE INDEX IF NOT EXISTS idx_upload_test_results_stage
  ON public.upload_test_results (stage, created_at DESC)
  WHERE stage IS NOT NULL;
