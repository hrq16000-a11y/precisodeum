-- Adicionar lead_type para distinguir leads qualificados de cliques diretos
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_type text NOT NULL DEFAULT 'qualified';

-- Validação: somente valores conhecidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_lead_type_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_lead_type_check
      CHECK (lead_type IN ('qualified','click_only'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_provider_lead_type
  ON public.leads(provider_id, lead_type, created_at DESC);

-- RPC para registrar clique direto (whatsapp/phone) como lead 'click_only'
-- Permite anônimos. Faz dedupe básico por janela curta para evitar spam.
CREATE OR REPLACE FUNCTION public.register_click_lead(
  _provider_id uuid,
  _contact_kind text,       -- 'whatsapp' | 'phone'
  _service_needed text DEFAULT NULL,
  _lead_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_owner uuid;
  v_user_ref text;
  v_existing uuid;
BEGIN
  IF _provider_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF _contact_kind NOT IN ('whatsapp','phone') THEN
    _contact_kind := 'whatsapp';
  END IF;

  SELECT user_id, user_ref INTO v_owner, v_user_ref
  FROM public.providers
  WHERE id = _provider_id
  LIMIT 1;

  IF v_owner IS NULL THEN
    RETURN NULL;
  END IF;

  -- Dedupe: se houver um click_only do mesmo contexto nos últimos 10 min, reaproveita.
  SELECT id INTO v_existing
  FROM public.leads
  WHERE provider_id = _provider_id
    AND lead_type = 'click_only'
    AND created_at > now() - interval '10 minutes'
    AND coalesce(lead_context->>'contact_kind','') = _contact_kind
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.leads (
    provider_id, user_id, user_ref, client_name, phone,
    service_needed, message, status, lead_type, lead_context
  ) VALUES (
    _provider_id, v_owner, v_user_ref,
    'Visitante (clique)', NULL,
    _service_needed, NULL, 'new', 'click_only',
    coalesce(_lead_context, '{}'::jsonb)
      || jsonb_build_object('contact_kind', _contact_kind, 'source', 'public_profile_click')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_click_lead(uuid, text, text, jsonb) TO anon, authenticated;