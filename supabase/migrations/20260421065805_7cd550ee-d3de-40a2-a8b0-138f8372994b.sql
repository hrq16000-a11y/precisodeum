
-- Tabela de sessões de impersonation
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ip_address text,
  user_agent text,
  reason text
);

CREATE INDEX IF NOT EXISTS idx_impersonation_admin ON public.impersonation_sessions(admin_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_target ON public.impersonation_sessions(target_user_id, started_at DESC);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_select_impersonation"
  ON public.impersonation_sessions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins_insert_impersonation"
  ON public.impersonation_sessions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND admin_id = auth.uid());

CREATE POLICY "admins_update_impersonation"
  ON public.impersonation_sessions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND admin_id = auth.uid());

-- Coluna para rastrear ações feitas via impersonation no audit log existente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='system_audit_logs' AND column_name='acted_as_admin_id'
  ) THEN
    ALTER TABLE public.system_audit_logs ADD COLUMN acted_as_admin_id uuid;
  END IF;
END$$;

-- RPC: registra início de impersonation
CREATE OR REPLACE FUNCTION public.admin_log_impersonation_start(
  _target_user_id uuid,
  _reason text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _ua text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  INSERT INTO public.impersonation_sessions (admin_id, target_user_id, ip_address, user_agent, reason)
  VALUES (auth.uid(), _target_user_id, _ip, _ua, _reason)
  RETURNING id INTO v_session_id;

  INSERT INTO public.system_audit_logs (staff_id, action, target_user_id, new_values)
  VALUES (
    auth.uid(),
    'impersonation_start',
    _target_user_id,
    jsonb_build_object('session_id', v_session_id, 'reason', _reason)
  );

  RETURN v_session_id;
END;
$$;

-- RPC: registra fim de impersonation
CREATE OR REPLACE FUNCTION public.admin_log_impersonation_end(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  UPDATE public.impersonation_sessions
    SET ended_at = now()
  WHERE id = _session_id AND admin_id = auth.uid() AND ended_at IS NULL
  RETURNING * INTO v_session;

  IF v_session.id IS NOT NULL THEN
    INSERT INTO public.system_audit_logs (staff_id, action, target_user_id, new_values)
    VALUES (
      auth.uid(),
      'impersonation_end',
      v_session.target_user_id,
      jsonb_build_object('session_id', v_session.id, 'duration_seconds',
        EXTRACT(EPOCH FROM (now() - v_session.started_at))::int)
    );
  END IF;
END;
$$;
