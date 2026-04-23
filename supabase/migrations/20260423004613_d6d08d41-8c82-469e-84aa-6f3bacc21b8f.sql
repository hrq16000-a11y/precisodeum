CREATE TABLE IF NOT EXISTS public.lead_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'message',
  old_status TEXT,
  new_status TEXT,
  message TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_history_lead_id_created_at ON public.lead_history(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_history_author_id ON public.lead_history(author_id);

ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can view own lead history" ON public.lead_history;
CREATE POLICY "Providers can view own lead history"
ON public.lead_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.providers p ON p.id = l.provider_id
    WHERE l.id = lead_history.lead_id
      AND p.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Providers can add own lead history" ON public.lead_history;
CREATE POLICY "Providers can add own lead history"
ON public.lead_history
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1
      FROM public.leads l
      JOIN public.providers p ON p.id = l.provider_id
      WHERE l.id = lead_history.lead_id
        AND p.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "Providers can update own leads" ON public.leads;
CREATE POLICY "Providers can update own leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.providers p
    WHERE p.id = leads.provider_id
      AND p.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.providers p
    WHERE p.id = leads.provider_id
      AND p.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE OR REPLACE FUNCTION public.audit_lead_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.lead_history (
      lead_id,
      author_id,
      entry_type,
      old_status,
      new_status,
      message
    ) VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.user_id, OLD.user_id),
      'status_change',
      OLD.status,
      NEW.status,
      'Status alterado'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_lead_status_change ON public.leads;
CREATE TRIGGER trg_audit_lead_status_change
AFTER UPDATE OF status ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.audit_lead_status_change();

ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_history;