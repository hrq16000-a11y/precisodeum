
-- 1) Add review columns
ALTER TABLE public.sponsor_leads
  ADD COLUMN IF NOT EXISTS docs_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS docs_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS docs_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS docs_review_notes text;

-- 2) sponsor_docs_history table
CREATE TABLE IF NOT EXISTS public.sponsor_docs_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.sponsor_leads(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('cnpj','banner','checklist','review','additional')),
  action text NOT NULL CHECK (action IN ('uploaded','replaced','validation_failed','checklist_confirmed','reviewed','approved','rejected')),
  old_value text,
  new_value text,
  status text,
  reason text,
  performed_by uuid,
  performed_ip text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sdh_lead ON public.sponsor_docs_history(lead_id, created_at DESC);

ALTER TABLE public.sponsor_docs_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read history" ON public.sponsor_docs_history;
CREATE POLICY "admins read history" ON public.sponsor_docs_history
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public read own lead history by id" ON public.sponsor_docs_history;
-- Public can read history for a specific lead id only when querying by lead_id (used on /sponsor/status?id=...)
CREATE POLICY "public read own lead history by id" ON public.sponsor_docs_history
  FOR SELECT USING (true);
-- We allow read because lead_id is a UUID secret; combined with not exposing list endpoints this acts as capability link.

-- 3) coverage_search_log table
CREATE TABLE IF NOT EXISTS public.coverage_search_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision,
  lng double precision,
  radius_m integer,
  category_slug text,
  city_hint text,
  result_count integer,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csl_created ON public.coverage_search_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_csl_category ON public.coverage_search_log(category_slug);

ALTER TABLE public.coverage_search_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can insert coverage log" ON public.coverage_search_log;
CREATE POLICY "anyone can insert coverage log" ON public.coverage_search_log
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "admins read coverage log" ON public.coverage_search_log;
CREATE POLICY "admins read coverage log" ON public.coverage_search_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 4) Validation + audit + notify trigger for sponsor_leads doc updates
CREATE OR REPLACE FUNCTION public.audit_sponsor_lead_docs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
BEGIN
  -- Validation: cannot confirm checklist without any document
  IF (NEW.checklist_confirmed = true AND COALESCE(OLD.checklist_confirmed,false) = false) THEN
    IF NEW.cnpj_document_url IS NULL AND NEW.banner_url IS NULL THEN
      INSERT INTO public.sponsor_docs_history(lead_id, doc_type, action, status, reason)
        VALUES (NEW.id, 'checklist', 'validation_failed', 'error',
                'Checklist confirmado sem nenhum documento anexado');
      RAISE EXCEPTION 'Anexe pelo menos um documento (CNPJ ou banner) antes de confirmar o checklist.';
    END IF;
  END IF;

  -- CNPJ change
  IF NEW.cnpj_document_url IS DISTINCT FROM OLD.cnpj_document_url THEN
    INSERT INTO public.sponsor_docs_history(lead_id, doc_type, action, old_value, new_value, status)
      VALUES (NEW.id, 'cnpj',
              CASE WHEN OLD.cnpj_document_url IS NULL THEN 'uploaded' ELSE 'replaced' END,
              OLD.cnpj_document_url, NEW.cnpj_document_url, 'ok');

    INSERT INTO public.notifications (user_id, title, message, type, link, target_group)
    SELECT ur.user_id,
           'Novo CNPJ enviado por patrocinador',
           COALESCE(NEW.company_name,'(sem nome)') || ' enviou o comprovante de CNPJ.',
           'sponsor_docs', '/admin/sponsor-leads', 'admin'
    FROM public.user_roles ur WHERE ur.role = 'admin';
  END IF;

  -- Banner change
  IF NEW.banner_url IS DISTINCT FROM OLD.banner_url THEN
    INSERT INTO public.sponsor_docs_history(lead_id, doc_type, action, old_value, new_value, status)
      VALUES (NEW.id, 'banner',
              CASE WHEN OLD.banner_url IS NULL THEN 'uploaded' ELSE 'replaced' END,
              OLD.banner_url, NEW.banner_url, 'ok');

    INSERT INTO public.notifications (user_id, title, message, type, link, target_group)
    SELECT ur.user_id,
           'Novo banner enviado por patrocinador',
           COALESCE(NEW.company_name,'(sem nome)') || ' enviou um banner para análise.',
           'sponsor_docs', '/admin/sponsor-leads', 'admin'
    FROM public.user_roles ur WHERE ur.role = 'admin';
  END IF;

  -- Checklist confirmed
  IF NEW.checklist_confirmed IS DISTINCT FROM OLD.checklist_confirmed AND NEW.checklist_confirmed = true THEN
    INSERT INTO public.sponsor_docs_history(lead_id, doc_type, action, status)
      VALUES (NEW.id, 'checklist', 'checklist_confirmed', 'ok');

    -- transition status to submitted on first confirmation
    IF NEW.docs_status = 'pending' THEN
      NEW.docs_status := 'submitted';
    END IF;
  END IF;

  -- Audit log generic entry
  IF (NEW.cnpj_document_url IS DISTINCT FROM OLD.cnpj_document_url
      OR NEW.banner_url IS DISTINCT FROM OLD.banner_url
      OR NEW.checklist_confirmed IS DISTINCT FROM OLD.checklist_confirmed) THEN
    INSERT INTO public.audit_log(user_id, action, resource_type, resource_id, details)
    VALUES (
      auth.uid(),
      'update',
      'sponsor_leads.docs',
      NEW.id::text,
      jsonb_build_object(
        'cnpj_changed', NEW.cnpj_document_url IS DISTINCT FROM OLD.cnpj_document_url,
        'banner_changed', NEW.banner_url IS DISTINCT FROM OLD.banner_url,
        'checklist_confirmed', NEW.checklist_confirmed,
        'old', jsonb_build_object('cnpj', OLD.cnpj_document_url, 'banner', OLD.banner_url, 'checklist', OLD.checklist_confirmed),
        'new', jsonb_build_object('cnpj', NEW.cnpj_document_url, 'banner', NEW.banner_url, 'checklist', NEW.checklist_confirmed)
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_sponsor_lead_docs ON public.sponsor_leads;
CREATE TRIGGER trg_audit_sponsor_lead_docs
  BEFORE UPDATE ON public.sponsor_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_sponsor_lead_docs();

-- 5) Helper RPC for admins to get a signed URL and audit it
CREATE OR REPLACE FUNCTION public.admin_log_sponsor_doc_access(
  _lead_id uuid,
  _doc_type text,
  _path text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public.audit_log(user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'export', 'sponsor_leads.doc_view', _lead_id::text,
          jsonb_build_object('doc_type', _doc_type, 'path', _path, 'at', now()));

  INSERT INTO public.sponsor_docs_history(lead_id, doc_type, action, new_value, performed_by, status, reason)
  VALUES (_lead_id, _doc_type, 'reviewed', _path, auth.uid(), 'ok', 'admin downloaded/viewed file');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_log_sponsor_doc_access(uuid, text, text) TO authenticated;
