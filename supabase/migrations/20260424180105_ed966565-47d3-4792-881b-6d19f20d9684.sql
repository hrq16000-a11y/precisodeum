
CREATE OR REPLACE FUNCTION public.admin_review_sponsor_docs(
  _lead_id uuid,
  _decision text,
  _reason text DEFAULT NULL
)
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

  -- Notify admins (audit trail visible in admin notifications)
  INSERT INTO notifications (user_id, title, message, type, link)
  SELECT ur.user_id,
         CASE WHEN v_new_status = 'approved' THEN 'Documentos aprovados' ELSE 'Documentos rejeitados' END,
         COALESCE(v_lead.company_name, 'Lead') || ' — ' || v_notes,
         'sponsor_docs_review',
         '/admin/sponsor-leads'
    FROM user_roles ur
   WHERE ur.role = 'admin'::app_role
     AND ur.user_id <> v_admin;

  RETURN jsonb_build_object(
    'success', true,
    'lead_id', _lead_id,
    'status', v_new_status,
    'reviewed_at', now(),
    'reopen_checklist', v_reopen_checklist
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_sponsor_docs(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_sponsor_docs(uuid, text, text) TO authenticated;
