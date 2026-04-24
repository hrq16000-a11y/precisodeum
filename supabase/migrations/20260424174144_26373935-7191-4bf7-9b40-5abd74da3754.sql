
DROP POLICY IF EXISTS "public read own lead history by id" ON public.sponsor_docs_history;

CREATE OR REPLACE FUNCTION public.get_sponsor_docs_status(_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_lead record;
  v_history jsonb;
BEGIN
  IF _lead_id IS NULL THEN
    RETURN jsonb_build_object('error','missing_id');
  END IF;

  SELECT id, company_name, status, docs_status, docs_reviewed_at, docs_review_notes,
         cnpj_document_url IS NOT NULL AS has_cnpj,
         banner_url IS NOT NULL AS has_banner,
         checklist_confirmed, docs_submitted_at, created_at
  INTO v_lead
  FROM public.sponsor_leads
  WHERE id = _lead_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','not_found');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'doc_type', doc_type, 'action', action,
    'status', status, 'reason', reason, 'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_history
  FROM public.sponsor_docs_history
  WHERE lead_id = _lead_id;

  RETURN jsonb_build_object('lead', to_jsonb(v_lead), 'history', v_history);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sponsor_docs_status(uuid) TO anon, authenticated;

-- Tighten coverage_search_log insert policy
DROP POLICY IF EXISTS "anyone can insert coverage log" ON public.coverage_search_log;
CREATE POLICY "anyone can insert valid coverage log"
  ON public.coverage_search_log
  FOR INSERT
  WITH CHECK (
    radius_m IS NULL OR (radius_m > 0 AND radius_m <= 500000)
  );
