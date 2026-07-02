-- 1. Add columns to sponsor_leads
ALTER TABLE public.sponsor_leads
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS pending_items text[];

CREATE INDEX IF NOT EXISTS idx_sponsor_leads_user_id ON public.sponsor_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_leads_docs_status ON public.sponsor_leads(docs_status);
CREATE INDEX IF NOT EXISTS idx_sponsor_leads_city ON public.sponsor_leads(lower(city));
CREATE INDEX IF NOT EXISTS idx_sponsor_leads_category ON public.sponsor_leads(category);

-- 2. Allow sponsor (owner) to read their own lead
DROP POLICY IF EXISTS "Sponsor can view own lead" ON public.sponsor_leads;
CREATE POLICY "Sponsor can view own lead" ON public.sponsor_leads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. Allow sponsor to read own docs history
DROP POLICY IF EXISTS "Sponsor reads own docs history" ON public.sponsor_docs_history;
CREATE POLICY "Sponsor reads own docs history" ON public.sponsor_docs_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsor_leads sl
      WHERE sl.id = sponsor_docs_history.lead_id
        AND sl.user_id = auth.uid()
    )
  );

-- 4. Claim RPC: link an authenticated user to their sponsor_lead by matching email
CREATE OR REPLACE FUNCTION public.claim_sponsor_lead(_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_lead public.sponsor_leads%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Faça login para vincular este cadastro.';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user;

  SELECT * INTO v_lead FROM public.sponsor_leads WHERE id = _lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cadastro não encontrado.';
  END IF;

  IF v_lead.user_id IS NOT NULL AND v_lead.user_id <> v_user THEN
    RAISE EXCEPTION 'Este cadastro já está vinculado a outra conta.';
  END IF;

  IF lower(coalesce(v_lead.email,'')) <> lower(coalesce(v_email,'')) THEN
    RAISE EXCEPTION 'O e-mail desta conta não confere com o e-mail do cadastro.';
  END IF;

  UPDATE public.sponsor_leads
     SET user_id = v_user, updated_at = now()
   WHERE id = _lead_id;

  RETURN jsonb_build_object('success', true, 'lead_id', _lead_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_sponsor_lead(uuid) TO authenticated;

-- 5. Update protect_sponsor_lead_fields trigger logic to allow user_id linking
-- (we need to confirm it does not block our updates — re-create permissive version)
CREATE OR REPLACE FUNCTION public.protect_sponsor_lead_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can do anything
  IF auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- The owner (linked user) updating their own lead is allowed for limited fields.
  IF auth.uid() IS NOT NULL AND OLD.user_id = auth.uid() THEN
    -- Owner can update docs/checklist fields only.
    IF NEW.company_name IS DISTINCT FROM OLD.company_name
       OR NEW.cnpj IS DISTINCT FROM OLD.cnpj
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.docs_status IS DISTINCT FROM OLD.docs_status
       OR NEW.docs_reviewed_at IS DISTINCT FROM OLD.docs_reviewed_at
       OR NEW.docs_reviewed_by IS DISTINCT FROM OLD.docs_reviewed_by
       OR NEW.docs_review_notes IS DISTINCT FROM OLD.docs_review_notes THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar dados comerciais ou o status de revisão.';
    END IF;
    RETURN NEW;
  END IF;

  -- Public path (within first 24h): allow only doc/checklist/user_id linking on fresh leads
  IF (now() - OLD.created_at) > interval '24 hours' THEN
    RAISE EXCEPTION 'Janela de envio de documentos expirou. Contate o suporte.';
  END IF;

  IF NEW.company_name IS DISTINCT FROM OLD.company_name
     OR NEW.cnpj IS DISTINCT FROM OLD.cnpj
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.docs_status IS DISTINCT FROM OLD.docs_status
     OR NEW.docs_reviewed_at IS DISTINCT FROM OLD.docs_reviewed_at
     OR NEW.docs_reviewed_by IS DISTINCT FROM OLD.docs_reviewed_by
     OR NEW.docs_review_notes IS DISTINCT FROM OLD.docs_review_notes
     OR NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar dados comerciais do lead.';
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Update admin_review_sponsor_docs to notify the sponsor user too
CREATE OR REPLACE FUNCTION public.admin_review_sponsor_docs(_lead_id uuid, _decision text, _reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_lead sponsor_leads%ROWTYPE;
  v_notes text;
  v_action text;
  v_new_status text;
  v_reopen_checklist boolean := false;
BEGIN
  IF NOT has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem revisar documentos.';
  END IF;

  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida. Use approved ou rejected.';
  END IF;

  SELECT * INTO v_lead FROM sponsor_leads WHERE id = _lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado.';
  END IF;

  IF _decision = 'approved' THEN
    v_notes := COALESCE(NULLIF(trim(_reason), ''), 'Aprovado');
    v_action := 'approved';
    v_new_status := 'approved';
  ELSE
    IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
      RAISE EXCEPTION 'Informe o motivo da rejeição (mínimo 5 caracteres).';
    END IF;
    v_notes := trim(_reason);
    v_action := 'rejected';
    v_new_status := 'rejected';
    v_reopen_checklist := true;
  END IF;

  UPDATE sponsor_leads
     SET docs_status = v_new_status,
         docs_reviewed_at = now(),
         docs_reviewed_by = v_admin,
         docs_review_notes = v_notes,
         checklist_confirmed = CASE WHEN v_reopen_checklist THEN false ELSE checklist_confirmed END,
         updated_at = now()
   WHERE id = _lead_id;

  INSERT INTO sponsor_docs_history (lead_id, doc_type, action, status, reason, performed_by, metadata)
  VALUES (_lead_id, 'review', v_action, v_new_status, v_notes, v_admin,
          jsonb_build_object('reopen_checklist', v_reopen_checklist));

  -- Notify other admins
  INSERT INTO notifications (user_id, title, message, type, link)
  SELECT ur.user_id,
         CASE WHEN v_new_status = 'approved' THEN 'Documentos aprovados' ELSE 'Documentos rejeitados' END,
         COALESCE(v_lead.company_name, 'Lead') || ' — ' || v_notes,
         'sponsor_docs_review',
         '/admin/sponsor-leads'
    FROM user_roles ur
   WHERE ur.role = 'admin'::app_role
     AND ur.user_id <> v_admin;

  -- Notify the sponsor (if linked to a user)
  IF v_lead.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      v_lead.user_id,
      CASE WHEN v_new_status = 'approved'
           THEN 'Sua documentação foi aprovada'
           ELSE 'Documentação reprovada — ação necessária' END,
      CASE WHEN v_new_status = 'approved'
           THEN 'Tudo certo! Seu cadastro como patrocinador está aprovado.'
           ELSE 'Motivo: ' || v_notes || ' (Revisado em ' || to_char(now(),'DD/MM/YYYY HH24:MI') || '). Reenvie os documentos solicitados.'
      END,
      CASE WHEN v_new_status = 'approved' THEN 'sponsor_docs_approved' ELSE 'sponsor_docs_rejected' END,
      '/sponsor/status?id=' || _lead_id::text
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'lead_id', _lead_id,
    'status', v_new_status,
    'reviewed_at', now(),
    'reopen_checklist', v_reopen_checklist,
    'notified_user', v_lead.user_id IS NOT NULL
  );
END;
$$;

-- 7. Reopen checklist RPC with pending items
CREATE OR REPLACE FUNCTION public.admin_reopen_sponsor_checklist(
  _lead_id uuid,
  _reason text,
  _pending_items text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_lead sponsor_leads%ROWTYPE;
  v_items_text text;
BEGIN
  IF NOT has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem reabrir o checklist.';
  END IF;

  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'Informe o motivo (mínimo 5 caracteres).';
  END IF;

  SELECT * INTO v_lead FROM sponsor_leads WHERE id = _lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado.';
  END IF;

  UPDATE sponsor_leads
     SET checklist_confirmed = false,
         pending_items = _pending_items,
         docs_status = 'pending',
         docs_review_notes = trim(_reason),
         docs_reviewed_at = now(),
         docs_reviewed_by = v_admin,
         updated_at = now()
   WHERE id = _lead_id;

  INSERT INTO sponsor_docs_history (lead_id, doc_type, action, status, reason, performed_by, metadata)
  VALUES (_lead_id, 'checklist', 'reopened', 'pending', trim(_reason), v_admin,
          jsonb_build_object('pending_items', COALESCE(to_jsonb(_pending_items), '[]'::jsonb)));

  v_items_text := CASE
    WHEN _pending_items IS NULL OR array_length(_pending_items, 1) IS NULL THEN ''
    ELSE ' Itens pendentes: ' || array_to_string(_pending_items, '; ') || '.'
  END;

  IF v_lead.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      v_lead.user_id,
      'Checklist reaberto pelo admin',
      'Motivo: ' || trim(_reason) || '.' || v_items_text || ' Acesse seu painel e reenvie os itens.',
      'sponsor_checklist_reopened',
      '/sponsor/status?id=' || _lead_id::text
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'lead_id', _lead_id, 'notified_user', v_lead.user_id IS NOT NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reopen_sponsor_checklist(uuid, text, text[]) TO authenticated;

-- 8. Admin-friendly view: full docs history with company name
CREATE OR REPLACE VIEW public.admin_sponsor_docs_history_view AS
SELECT
  h.id,
  h.lead_id,
  sl.company_name,
  sl.email,
  sl.docs_status AS current_status,
  h.doc_type,
  h.action,
  h.status,
  h.reason,
  h.performed_by,
  h.metadata,
  h.created_at
FROM public.sponsor_docs_history h
LEFT JOIN public.sponsor_leads sl ON sl.id = h.lead_id;

GRANT SELECT ON public.admin_sponsor_docs_history_view TO authenticated;