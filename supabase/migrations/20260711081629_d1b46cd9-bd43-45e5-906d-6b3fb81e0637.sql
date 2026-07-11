-- =============================================================
-- 1) Tabela de auditoria dedicada
-- =============================================================
CREATE TABLE IF NOT EXISTS public.sponsor_lead_docs_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('attach_docs','contract_accept')),
  outcome text NOT NULL CHECK (outcome IN ('success','invalid_token','expired','already_claimed','invalid_arguments')),
  fields_present text[] NOT NULL DEFAULT ARRAY[]::text[],
  actor_ip text,
  actor_user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sponsor_lead_docs_audit TO authenticated;
GRANT ALL ON public.sponsor_lead_docs_audit TO service_role;

ALTER TABLE public.sponsor_lead_docs_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view sponsor lead docs audit" ON public.sponsor_lead_docs_audit;
CREATE POLICY "Admins can view sponsor lead docs audit"
  ON public.sponsor_lead_docs_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Nenhuma policy de INSERT/UPDATE/DELETE — só service_role (usado pelas RPCs
-- SECURITY DEFINER) consegue escrever. Isso impede que qualquer cliente
-- (mesmo autenticado) forje registros de auditoria.

CREATE INDEX IF NOT EXISTS idx_sponsor_lead_docs_audit_lead_created
  ON public.sponsor_lead_docs_audit (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sponsor_lead_docs_audit_outcome_created
  ON public.sponsor_lead_docs_audit (outcome, created_at DESC);

-- =============================================================
-- 2) attach_sponsor_lead_docs — erros diferenciados + auditoria
-- =============================================================
CREATE OR REPLACE FUNCTION public.attach_sponsor_lead_docs(
  _lead_id uuid,
  _token uuid,
  _cnpj_document_url text DEFAULT NULL,
  _banner_url text DEFAULT NULL,
  _checklist_confirmed boolean DEFAULT NULL,
  _additional_docs jsonb DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.sponsor_leads%ROWTYPE;
  v_fields text[] := ARRAY[]::text[];
  v_outcome text;
BEGIN
  IF _cnpj_document_url IS NOT NULL THEN v_fields := array_append(v_fields, 'cnpj_document_url'); END IF;
  IF _banner_url IS NOT NULL THEN v_fields := array_append(v_fields, 'banner_url'); END IF;
  IF _checklist_confirmed IS NOT NULL THEN v_fields := array_append(v_fields, 'checklist_confirmed'); END IF;
  IF _additional_docs IS NOT NULL THEN v_fields := array_append(v_fields, 'additional_docs'); END IF;

  IF _lead_id IS NULL OR _token IS NULL THEN
    INSERT INTO public.sponsor_lead_docs_audit (lead_id, action, outcome, fields_present)
    VALUES (COALESCE(_lead_id, '00000000-0000-0000-0000-000000000000'::uuid),
            'attach_docs', 'invalid_arguments', v_fields);
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.sponsor_leads WHERE id = _lead_id;

  IF NOT FOUND OR v_row.submission_token IS DISTINCT FROM _token THEN
    v_outcome := 'invalid_token';
  ELSIF v_row.user_id IS NOT NULL THEN
    v_outcome := 'already_claimed';
  ELSIF v_row.created_at <= now() - interval '24 hours' THEN
    v_outcome := 'expired';
  ELSE
    v_outcome := 'success';
  END IF;

  INSERT INTO public.sponsor_lead_docs_audit (lead_id, action, outcome, fields_present)
  VALUES (_lead_id, 'attach_docs', v_outcome, v_fields);

  IF v_outcome <> 'success' THEN
    RAISE EXCEPTION '%', v_outcome USING ERRCODE = '42501';
  END IF;

  UPDATE public.sponsor_leads
     SET cnpj_document_url   = COALESCE(_cnpj_document_url, cnpj_document_url),
         banner_url          = COALESCE(_banner_url, banner_url),
         checklist_confirmed = COALESCE(_checklist_confirmed, checklist_confirmed),
         additional_docs     = COALESCE(_additional_docs, additional_docs),
         docs_submitted_at   = COALESCE(docs_submitted_at, now()),
         updated_at          = now()
   WHERE id = _lead_id
     AND submission_token = _token
     AND user_id IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_sponsor_lead_docs(uuid, uuid, text, text, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_sponsor_lead_docs(uuid, uuid, text, text, boolean, jsonb)
  TO anon, authenticated, service_role;

-- =============================================================
-- 3) accept_sponsor_lead_contract — substitui UPDATE direto anon
--    do SponsorContractPage.
-- =============================================================
CREATE OR REPLACE FUNCTION public.accept_sponsor_lead_contract(
  _lead_id uuid,
  _token uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.sponsor_leads%ROWTYPE;
  v_outcome text;
BEGIN
  IF _lead_id IS NULL OR _token IS NULL THEN
    INSERT INTO public.sponsor_lead_docs_audit (lead_id, action, outcome, fields_present)
    VALUES (COALESCE(_lead_id, '00000000-0000-0000-0000-000000000000'::uuid),
            'contract_accept', 'invalid_arguments', ARRAY[]::text[]);
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.sponsor_leads WHERE id = _lead_id;

  IF NOT FOUND OR v_row.submission_token IS DISTINCT FROM _token THEN
    v_outcome := 'invalid_token';
  ELSIF v_row.user_id IS NOT NULL THEN
    v_outcome := 'already_claimed';
  ELSIF v_row.created_at <= now() - interval '24 hours' THEN
    v_outcome := 'expired';
  ELSE
    v_outcome := 'success';
  END IF;

  INSERT INTO public.sponsor_lead_docs_audit (lead_id, action, outcome, fields_present)
  VALUES (_lead_id, 'contract_accept', v_outcome, ARRAY['contract_accepted']);

  IF v_outcome <> 'success' THEN
    RAISE EXCEPTION '%', v_outcome USING ERRCODE = '42501';
  END IF;

  UPDATE public.sponsor_leads
     SET contract_accepted = true,
         status = CASE WHEN status = 'pending' THEN 'contract_signed' ELSE status END,
         updated_at = now()
   WHERE id = _lead_id
     AND submission_token = _token
     AND user_id IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_sponsor_lead_contract(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_sponsor_lead_contract(uuid, uuid)
  TO anon, authenticated, service_role;
