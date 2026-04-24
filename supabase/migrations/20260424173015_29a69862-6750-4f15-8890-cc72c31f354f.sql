
-- 1. Adicionar colunas em sponsor_leads
ALTER TABLE public.sponsor_leads
  ADD COLUMN IF NOT EXISTS cnpj_document_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS additional_docs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS checklist_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS docs_submitted_at timestamptz;

-- 2. Criar bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsor_assets', 'sponsor_assets', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 3. RLS storage.objects - sponsor_assets
DROP POLICY IF EXISTS "sponsor_assets insert public" ON storage.objects;
DROP POLICY IF EXISTS "sponsor_assets admin select" ON storage.objects;
DROP POLICY IF EXISTS "sponsor_assets admin update" ON storage.objects;
DROP POLICY IF EXISTS "sponsor_assets admin delete" ON storage.objects;

-- INSERT: qualquer usuário (anon ou auth) pode subir, desde que o caminho seja leads/<uuid>/...
CREATE POLICY "sponsor_assets insert public"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'sponsor_assets'
    AND (storage.foldername(name))[1] = 'leads'
    AND (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
  );

-- SELECT: somente admins
CREATE POLICY "sponsor_assets admin select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sponsor_assets'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- UPDATE / DELETE: somente admins
CREATE POLICY "sponsor_assets admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'sponsor_assets' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'sponsor_assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "sponsor_assets admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'sponsor_assets' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Permitir update público RESTRITO em sponsor_leads para anexar documentos/checklist
-- (apenas dentro de 24h após criação, e apenas nessas colunas via trigger de proteção)
DROP POLICY IF EXISTS "Public can attach docs to recent lead" ON public.sponsor_leads;
CREATE POLICY "Public can attach docs to recent lead"
  ON public.sponsor_leads FOR UPDATE
  TO public
  USING (created_at > now() - interval '24 hours')
  WITH CHECK (created_at > now() - interval '24 hours');

-- Trigger para impedir alteração de campos sensíveis via update público
CREATE OR REPLACE FUNCTION public.protect_sponsor_lead_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins podem alterar tudo
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Para qualquer outro usuário, só permitir alteração das colunas de docs/checklist
  IF NEW.company_name IS DISTINCT FROM OLD.company_name
     OR NEW.cnpj IS DISTINCT FROM OLD.cnpj
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.contract_accepted IS DISTINCT FROM OLD.contract_accepted
  THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar dados comerciais do lead.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_sponsor_lead_fields ON public.sponsor_leads;
CREATE TRIGGER trg_protect_sponsor_lead_fields
  BEFORE UPDATE ON public.sponsor_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sponsor_lead_fields();
