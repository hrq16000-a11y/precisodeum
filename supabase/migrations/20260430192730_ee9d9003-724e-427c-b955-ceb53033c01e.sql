-- Tabela de resultados de teste de stress de upload
CREATE TABLE IF NOT EXISTS public.upload_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scenario TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 1,
  success BOOLEAN NOT NULL,
  total_ms INT NOT NULL,
  file_size_bytes INT,
  error_code TEXT,
  device_ua TEXT,
  effective_type TEXT,
  downlink_mbps NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upload_test_results_scenario ON public.upload_test_results (scenario, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_test_results_user ON public.upload_test_results (user_id, created_at DESC);

ALTER TABLE public.upload_test_results ENABLE ROW LEVEL SECURITY;

-- Inserir o próprio resultado
CREATE POLICY "users_insert_own_upload_test"
  ON public.upload_test_results
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Ler os próprios resultados
CREATE POLICY "users_read_own_upload_test"
  ON public.upload_test_results
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins podem ler tudo
CREATE POLICY "admins_read_all_upload_test"
  ON public.upload_test_results
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
