CREATE TABLE IF NOT EXISTS public.health_check_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  source TEXT NOT NULL DEFAULT 'dashboard',
  ok BOOLEAN NOT NULL,
  failed_rpcs TEXT[] NOT NULL DEFAULT '{}',
  failed_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw JSONB
);

CREATE INDEX IF NOT EXISTS idx_health_check_history_created_at
  ON public.health_check_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_check_history_ok
  ON public.health_check_history (ok, created_at DESC);

ALTER TABLE public.health_check_history ENABLE ROW LEVEL SECURITY;

-- Admins read everything
CREATE POLICY "Admins can read health history"
  ON public.health_check_history
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert their own audit record
CREATE POLICY "Authenticated users insert own health record"
  ON public.health_check_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- Auto-cleanup of records older than 30 days (best-effort on insert)
CREATE OR REPLACE FUNCTION public.health_check_history_autoclean()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- only run cleanup once every ~50 inserts to keep cost low
  IF (random() < 0.02) THEN
    DELETE FROM public.health_check_history
    WHERE created_at < now() - INTERVAL '30 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_health_check_history_autoclean ON public.health_check_history;
CREATE TRIGGER trg_health_check_history_autoclean
  AFTER INSERT ON public.health_check_history
  FOR EACH ROW
  EXECUTE FUNCTION public.health_check_history_autoclean();