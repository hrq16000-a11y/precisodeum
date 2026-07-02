
CREATE OR REPLACE FUNCTION public.log_sponsor_doc_validation_failure(
  _lead_id uuid,
  _doc_type text,
  _reason text,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company text;
  v_recent_failures int;
BEGIN
  IF _lead_id IS NULL OR _doc_type NOT IN ('cnpj','banner','additional') THEN
    RETURN;
  END IF;

  SELECT company_name INTO v_company FROM public.sponsor_leads
   WHERE id = _lead_id AND created_at > now() - interval '48 hours';
  IF NOT FOUND THEN
    RETURN; -- silently drop unknown / old leads
  END IF;

  INSERT INTO public.sponsor_docs_history(lead_id, doc_type, action, status, reason, metadata)
  VALUES (_lead_id, _doc_type, 'validation_failed', 'error', LEFT(_reason, 500), COALESCE(_metadata, '{}'::jsonb));

  -- notify admins only when failures pile up (>=3 in last 10 min) to avoid spam
  SELECT count(*) INTO v_recent_failures
  FROM public.sponsor_docs_history
  WHERE lead_id = _lead_id AND action = 'validation_failed'
    AND created_at > now() - interval '10 minutes';

  IF v_recent_failures >= 3 THEN
    INSERT INTO public.notifications (user_id, title, message, type, link, target_group)
    SELECT ur.user_id,
           'Patrocinador com falhas de upload',
           COALESCE(v_company,'(sem nome)') || ' teve ' || v_recent_failures || ' falhas de validação no envio de documentos.',
           'sponsor_docs', '/admin/sponsor-leads', 'admin'
    FROM public.user_roles ur WHERE ur.role = 'admin';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_sponsor_doc_validation_failure(uuid, text, text, jsonb) TO anon, authenticated;
