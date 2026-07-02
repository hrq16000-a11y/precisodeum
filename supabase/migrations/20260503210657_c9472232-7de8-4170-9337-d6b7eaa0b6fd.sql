-- Colunas novas (nullable para compat com inserts antigos do client)
ALTER TABLE public.auth_profile_metrics
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS lock_broken_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS environment text;

-- Constraint leve no outcome (apenas valores conhecidos quando preenchido)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'auth_profile_metrics_outcome_chk'
  ) THEN
    ALTER TABLE public.auth_profile_metrics
      ADD CONSTRAINT auth_profile_metrics_outcome_chk
      CHECK (outcome IS NULL OR outcome IN ('resolved','watchdog_forced','no_session'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auth_profile_metrics_recorded_at
  ON public.auth_profile_metrics (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_profile_metrics_outcome
  ON public.auth_profile_metrics (outcome, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_profile_metrics_environment
  ON public.auth_profile_metrics (environment, recorded_at DESC);

-- Garante RLS habilitada
ALTER TABLE public.auth_profile_metrics ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas para não acumular regras conflitantes
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT polname FROM pg_policy WHERE polrelid = 'public.auth_profile_metrics'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.auth_profile_metrics', p.polname);
  END LOOP;
END $$;

-- Admins (qualquer role admin via has_role) podem ler tudo
CREATE POLICY "auth_profile_metrics: admins select all"
  ON public.auth_profile_metrics
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Usuário autenticado pode ler suas próprias métricas (debug self-service)
CREATE POLICY "auth_profile_metrics: users select own"
  ON public.auth_profile_metrics
  FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

-- Insert: telemetria fail-soft. Anon pode inserir SEM user_id (boot pré-sessão);
-- autenticado pode inserir só com user_id próprio ou nulo.
CREATE POLICY "auth_profile_metrics: anon insert no user"
  ON public.auth_profile_metrics
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "auth_profile_metrics: auth insert self"
  ON public.auth_profile_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Sem políticas de UPDATE/DELETE → bloqueado por default (apenas service role).
