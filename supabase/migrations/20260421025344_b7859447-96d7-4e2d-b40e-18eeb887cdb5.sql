-- 1. Subtipo do profissional (Autônomo vs Empresa)
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'autonomous',
  ADD COLUMN IF NOT EXISTS legal_name text;

ALTER TABLE public.providers
  DROP CONSTRAINT IF EXISTS providers_account_type_check;
ALTER TABLE public.providers
  ADD CONSTRAINT providers_account_type_check
  CHECK (account_type IN ('autonomous','company'));

-- 2. Tabela de Agências de RH
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  cnpj text,
  description text NOT NULL DEFAULT '',
  city text,
  state text,
  whatsapp text,
  email text,
  website text,
  logo_url text,
  cover_image_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agencies_user_id ON public.agencies(user_id);
CREATE INDEX IF NOT EXISTS idx_agencies_status ON public.agencies(status);

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agencies public can view approved" ON public.agencies;
CREATE POLICY "Agencies public can view approved"
  ON public.agencies FOR SELECT
  USING (status = 'approved');

DROP POLICY IF EXISTS "Agencies owner can view own" ON public.agencies;
CREATE POLICY "Agencies owner can view own"
  ON public.agencies FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Agencies owner can insert" ON public.agencies;
CREATE POLICY "Agencies owner can insert"
  ON public.agencies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Agencies owner can update" ON public.agencies;
CREATE POLICY "Agencies owner can update"
  ON public.agencies FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Agencies owner can delete" ON public.agencies;
CREATE POLICY "Agencies owner can delete"
  ON public.agencies FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_agencies()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_agencies_updated_at ON public.agencies;
CREATE TRIGGER trg_agencies_updated_at
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_agencies();