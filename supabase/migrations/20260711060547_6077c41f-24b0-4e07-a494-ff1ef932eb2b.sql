-- ============================================================
-- FIX 1: reviews.admin_note exposto publicamente
-- Estratégia: mover para tabela separada admin-only e dropar a coluna.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.review_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES public.reviews(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_admin_notes TO authenticated;
GRANT ALL ON public.review_admin_notes TO service_role;

ALTER TABLE public.review_admin_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage review notes" ON public.review_admin_notes;
CREATE POLICY "Admins manage review notes"
  ON public.review_admin_notes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger de updated_at reutiliza função existente do projeto se disponível;
-- caso contrário cria uma dedicada com search_path fixo.
CREATE OR REPLACE FUNCTION public.tg_review_admin_notes_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_admin_notes_touch ON public.review_admin_notes;
CREATE TRIGGER trg_review_admin_notes_touch
  BEFORE UPDATE ON public.review_admin_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_review_admin_notes_touch();

-- Migração de dados existentes (se a coluna ainda existir).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'admin_note'
  ) THEN
    EXECUTE $mig$
      INSERT INTO public.review_admin_notes (review_id, note)
      SELECT id, admin_note
      FROM public.reviews
      WHERE admin_note IS NOT NULL AND btrim(admin_note) <> ''
      ON CONFLICT (review_id) DO NOTHING
    $mig$;
    EXECUTE 'ALTER TABLE public.reviews DROP COLUMN admin_note';
  END IF;
END $$;

-- ============================================================
-- FIX 2: sponsor_leads UPDATE anon sem binding de ownership
-- Estratégia: adicionar submission_token secreto por lead + RPC SECURITY DEFINER
-- que valida o token; remover a policy permissiva.
-- ============================================================
ALTER TABLE public.sponsor_leads
  ADD COLUMN IF NOT EXISTS submission_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Drop policy vulnerável.
DROP POLICY IF EXISTS "Anon attach unclaimed lead docs" ON public.sponsor_leads;

-- RPC segura para anexar documentos usando o token retornado no insert.
-- - Só atualiza colunas relacionadas a docs/checklist (nunca email/phone/cnpj/company_name/plan/status).
-- - Exige token exato + lead ainda unclaimed + janela de 24h.
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
  v_found boolean;
BEGIN
  IF _lead_id IS NULL OR _token IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT true INTO v_found
  FROM public.sponsor_leads
  WHERE id = _lead_id
    AND submission_token = _token
    AND user_id IS NULL
    AND created_at > now() - interval '24 hours'
  LIMIT 1;

  IF NOT COALESCE(v_found, false) THEN
    RAISE EXCEPTION 'invalid_or_expired_lead' USING ERRCODE = '42501';
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