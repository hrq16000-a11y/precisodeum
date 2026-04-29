-- Tabela de auditoria de consentimento de cookies (LGPD)
CREATE TABLE IF NOT EXISTS public.cookie_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  essential BOOLEAN NOT NULL DEFAULT TRUE,
  functional BOOLEAN NOT NULL DEFAULT FALSE,
  analytics BOOLEAN NOT NULL DEFAULT FALSE,
  marketing BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'banner',
  user_agent TEXT NULL,
  ip_address TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cookie_consent_log_user ON public.cookie_consent_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_log_anon ON public.cookie_consent_log(anon_id, created_at DESC);

ALTER TABLE public.cookie_consent_log ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode inserir o próprio consentimento
DROP POLICY IF EXISTS "Anyone can record own consent" ON public.cookie_consent_log;
CREATE POLICY "Anyone can record own consent"
ON public.cookie_consent_log
FOR INSERT
TO anon, authenticated
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid()
);

-- Usuário autenticado lê os próprios registros
DROP POLICY IF EXISTS "Users read own consent" ON public.cookie_consent_log;
CREATE POLICY "Users read own consent"
ON public.cookie_consent_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins leem tudo (usa has_role já existente)
DROP POLICY IF EXISTS "Admins read all consent" ON public.cookie_consent_log;
CREATE POLICY "Admins read all consent"
ON public.cookie_consent_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));