-- Solicitações de exclusão de conta (Google Play compliance)
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NULL,
  email TEXT NOT NULL,
  full_name TEXT NULL,
  reason TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','processando','concluida','cancelada')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  processed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  admin_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_email ON public.account_deletion_requests (email);
CREATE INDEX IF NOT EXISTS idx_account_deletion_status ON public.account_deletion_requests (status, scheduled_for);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can request deletion"
  ON public.account_deletion_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "user can view own deletion requests"
  ON public.account_deletion_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "admins manage deletion requests"
  ON public.account_deletion_requests
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_account_deletion_updated_at
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Eventos de e-mail (webhook Resend para auditoria)
CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'resend',
  message_id TEXT NULL,
  event_type TEXT NOT NULL,
  recipient TEXT NULL,
  subject TEXT NULL,
  template TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_events_message ON public.email_events (message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient ON public.email_events (recipient);
CREATE INDEX IF NOT EXISTS idx_email_events_type_time ON public.email_events (event_type, occurred_at DESC);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read email events"
  ON public.email_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'));