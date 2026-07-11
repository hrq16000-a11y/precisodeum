-- Rate limiting + anti-replay for attach_sponsor_lead_docs and accept_sponsor_lead_contract.
-- Reuses public.sponsor_lead_docs_audit as the throttle window source-of-truth.

CREATE INDEX IF NOT EXISTS idx_sponsor_lead_docs_audit_lead_outcome_created
  ON public.sponsor_lead_docs_audit (lead_id, outcome, created_at DESC);

-- New allowed outcome: rate_limited. Recreate CHECK constraint.
ALTER TABLE public.sponsor_lead_docs_audit
  DROP CONSTRAINT IF EXISTS sponsor_lead_docs_audit_outcome_check;
ALTER TABLE public.sponsor_lead_docs_audit
  ADD CONSTRAINT sponsor_lead_docs_audit_outcome_check
  CHECK (outcome IN ('success','invalid_token','expired','already_claimed','invalid_arguments','rate_limited'));

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
  v_recent_failures int;
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

  -- Rate limit: 5 falhas por lead nos últimos 15 minutos = bloqueio temporário.
  -- Anti-brute-force para tokens desconhecidos ou expirados.
  SELECT count(*) INTO v_recent_failures
    FROM public.sponsor_lead_docs_audit
   WHERE lead_id = _lead_id
     AND outcome IN ('invalid_token','expired','already_claimed','rate_limited')
     AND created_at > now() - interval '15 minutes';

  IF v_recent_failures >= 5 THEN
    INSERT INTO public.sponsor_lead_docs_audit (lead_id, action, outcome, fields_present)
    VALUES (_lead_id, 'attach_docs', 'rate_limited', v_fields);
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.sponsor_leads WHERE id = _lead_id;

  IF NOT FOUND OR v_row.submission_token IS NULL OR v_row.submission_token IS DISTINCT FROM _token THEN
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
         submission_token    = NULL,  -- Anti-replay: token consumido é invalidado
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

-- Aplica mesma proteção no accept_sponsor_lead_contract (não invalida token
-- porque o modal de docs pode ainda ser chamado depois; mantém apenas rate limit).
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
  v_recent_failures int;
BEGIN
  IF _lead_id IS NULL OR _token IS NULL THEN
    INSERT INTO public.sponsor_lead_docs_audit (lead_id, action, outcome, fields_present)
    VALUES (COALESCE(_lead_id, '00000000-0000-0000-0000-000000000000'::uuid),
            'contract_accept', 'invalid_arguments', ARRAY[]::text[]);
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_recent_failures
    FROM public.sponsor_lead_docs_audit
   WHERE lead_id = _lead_id
     AND outcome IN ('invalid_token','expired','already_claimed','rate_limited')
     AND created_at > now() - interval '15 minutes';

  IF v_recent_failures >= 5 THEN
    INSERT INTO public.sponsor_lead_docs_audit (lead_id, action, outcome, fields_present)
    VALUES (_lead_id, 'contract_accept', 'rate_limited', ARRAY[]::text[]);
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.sponsor_leads WHERE id = _lead_id;

  IF NOT FOUND OR v_row.submission_token IS NULL OR v_row.submission_token IS DISTINCT FROM _token THEN
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