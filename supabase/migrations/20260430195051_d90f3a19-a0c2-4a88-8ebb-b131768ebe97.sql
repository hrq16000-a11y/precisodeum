-- Adicionar coluna error_kind para taxonomia de falhas de upload
ALTER TABLE public.upload_test_results
  ADD COLUMN IF NOT EXISTS error_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_upload_test_results_error_kind
  ON public.upload_test_results (error_kind, created_at DESC)
  WHERE error_kind IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_upload_test_results_network
  ON public.upload_test_results (effective_type, success, created_at DESC)
  WHERE effective_type IS NOT NULL;

-- RPC: agrega taxa de falha recente por (effective_type, downlink_band, device_family)
-- Usada pelo cliente para calibrar thresholds de compressão adaptativa.
CREATE OR REPLACE FUNCTION public.upload_failure_stats(_lookback_hours INT DEFAULT 24)
RETURNS TABLE (
  effective_type TEXT,
  downlink_band TEXT,
  device_family TEXT,
  total INT,
  failures INT,
  fail_rate NUMERIC,
  avg_total_ms NUMERIC,
  avg_attempts NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent AS (
    SELECT
      COALESCE(NULLIF(effective_type, ''), 'unknown') AS effective_type,
      CASE
        WHEN downlink_mbps IS NULL THEN 'unknown'
        WHEN downlink_mbps < 0.5 THEN '<0.5'
        WHEN downlink_mbps < 1.5 THEN '0.5-1.5'
        WHEN downlink_mbps < 5   THEN '1.5-5'
        ELSE '5+'
      END AS downlink_band,
      CASE
        WHEN device_ua ~* '(ipad|tablet)' THEN 'tablet'
        WHEN device_ua ~* '(android|iphone|mobile)' THEN 'mobile'
        ELSE 'desktop'
      END AS device_family,
      success,
      total_ms,
      attempts
    FROM upload_test_results
    WHERE created_at > now() - make_interval(hours => _lookback_hours)
      AND scenario IN ('production', 'off')
      AND stage IS NULL  -- só linhas "uploads completos", não etapas
  )
  SELECT
    effective_type,
    downlink_band,
    device_family,
    COUNT(*)::INT AS total,
    SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::INT AS failures,
    ROUND((SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::NUMERIC / GREATEST(COUNT(*), 1)), 3) AS fail_rate,
    ROUND(AVG(total_ms), 0) AS avg_total_ms,
    ROUND(AVG(attempts), 2) AS avg_attempts
  FROM recent
  GROUP BY effective_type, downlink_band, device_family
  HAVING COUNT(*) >= 3;  -- ignora amostras pequenas (ruído)
$$;

GRANT EXECUTE ON FUNCTION public.upload_failure_stats(INT) TO authenticated;