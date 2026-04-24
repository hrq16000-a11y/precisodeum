DROP VIEW IF EXISTS public.admin_sponsor_docs_history_view;

CREATE VIEW public.admin_sponsor_docs_history_view
WITH (security_invoker = true) AS
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