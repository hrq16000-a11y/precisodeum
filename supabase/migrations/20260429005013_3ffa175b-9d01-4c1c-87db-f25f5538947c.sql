-- Permite registrar tentativas bloqueadas pelo kill-switch (sem service criado).
ALTER TABLE public.service_quality_log
  ALTER COLUMN service_id DROP NOT NULL;

-- Garantia: pelo menos service_id OU reason='blocked_by_policy' precisa estar presente.
ALTER TABLE public.service_quality_log
  DROP CONSTRAINT IF EXISTS service_quality_log_service_or_blocked;
ALTER TABLE public.service_quality_log
  ADD CONSTRAINT service_quality_log_service_or_blocked
  CHECK (service_id IS NOT NULL OR reason = 'blocked_by_policy');

CREATE INDEX IF NOT EXISTS idx_service_quality_log_reason
  ON public.service_quality_log (reason, created_at DESC);