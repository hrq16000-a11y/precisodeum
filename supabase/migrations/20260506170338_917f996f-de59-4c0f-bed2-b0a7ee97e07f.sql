CREATE TABLE IF NOT EXISTS public.support_context_snapshot_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  profile_slug text,
  current_plan text,
  account_level text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scsl_ticket ON public.support_context_snapshot_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_scsl_user ON public.support_context_snapshot_log(user_id);
CREATE INDEX IF NOT EXISTS idx_scsl_created ON public.support_context_snapshot_log(created_at DESC);

ALTER TABLE public.support_context_snapshot_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snapshot_log_select_own_or_admin" ON public.support_context_snapshot_log;
CREATE POLICY "snapshot_log_select_own_or_admin"
ON public.support_context_snapshot_log FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "snapshot_log_insert_own" ON public.support_context_snapshot_log;
CREATE POLICY "snapshot_log_insert_own"
ON public.support_context_snapshot_log FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.user_id = auth.uid()
  )
);