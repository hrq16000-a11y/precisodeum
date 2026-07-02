-- 1) Bump remote-config para forçar cache-clear em todas as instâncias
INSERT INTO public.site_settings (key, value)
VALUES
  ('app_min_version', '1.1.0'),
  ('app_latest_version', '1.1.0'),
  ('app_update_force_message', 'Aplicamos correções importantes no cadastro. Vamos atualizar e limpar o cache automaticamente.'),
  ('app_update_suggest_message', 'Nova versão disponível com correções no cadastro.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 2) Tabela de revogações de consentimento (alimenta painel admin)
CREATE TABLE IF NOT EXISTS public.consent_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id TEXT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  revoked_categories TEXT[] NOT NULL DEFAULT '{}'::text[],
  previous_state JSONB NULL,
  current_state JSONB NULL,
  source TEXT NOT NULL DEFAULT 'banner',
  user_agent TEXT NULL,
  read_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_revocations_user ON public.consent_revocations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_revocations_unread ON public.consent_revocations(read_by_admin, created_at DESC);

ALTER TABLE public.consent_revocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can record own revocation" ON public.consent_revocations;
CREATE POLICY "Anyone can record own revocation"
ON public.consent_revocations
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own revocations" ON public.consent_revocations;
CREATE POLICY "Users read own revocations"
ON public.consent_revocations
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all revocations" ON public.consent_revocations;
CREATE POLICY "Admins read all revocations"
ON public.consent_revocations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update revocations" ON public.consent_revocations;
CREATE POLICY "Admins update revocations"
ON public.consent_revocations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) RPC: listar revogações (admin-only) com email do usuário
CREATE OR REPLACE FUNCTION public.list_consent_revocations(
  _limit INTEGER DEFAULT 50,
  _offset INTEGER DEFAULT 0,
  _only_unread BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  anon_id TEXT,
  version INTEGER,
  revoked_categories TEXT[],
  previous_state JSONB,
  current_state JSONB,
  source TEXT,
  read_by_admin BOOLEAN,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT *
    FROM public.consent_revocations
    WHERE (NOT _only_unread OR read_by_admin = FALSE)
  ), counted AS (
    SELECT COUNT(*) AS total FROM base
  )
  SELECT
    b.id,
    b.user_id,
    (SELECT au.email::text FROM auth.users au WHERE au.id = b.user_id) AS user_email,
    b.anon_id,
    b.version,
    b.revoked_categories,
    b.previous_state,
    b.current_state,
    b.source,
    b.read_by_admin,
    b.created_at,
    (SELECT total FROM counted) AS total_count
  FROM base b
  ORDER BY b.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200))
  OFFSET GREATEST(0, _offset);
END;
$$;

REVOKE ALL ON FUNCTION public.list_consent_revocations(INTEGER, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_consent_revocations(INTEGER, INTEGER, BOOLEAN) TO authenticated;

-- 4) RPC: marcar revogações como lidas (admin-only)
CREATE OR REPLACE FUNCTION public.mark_consent_revocations_read(_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.consent_revocations
     SET read_by_admin = TRUE
   WHERE id = ANY(_ids);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN COALESCE(affected, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_consent_revocations_read(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_consent_revocations_read(UUID[]) TO authenticated;