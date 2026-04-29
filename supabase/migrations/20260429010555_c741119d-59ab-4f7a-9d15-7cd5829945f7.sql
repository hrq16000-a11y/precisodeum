-- 1. Tabela de interações
CREATE TABLE IF NOT EXISTS public.lead_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('whatsapp','phone','profile','click','share')),
  source TEXT,
  ua_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_interactions_provider_created
  ON public.lead_interactions(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_service
  ON public.lead_interactions(service_id) WHERE service_id IS NOT NULL;

ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;

-- Provider lê os próprios eventos
CREATE POLICY "providers read own interactions"
ON public.lead_interactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = lead_interactions.provider_id
      AND p.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Bloqueia INSERT direto: deve passar pelo RPC
CREATE POLICY "no direct insert lead_interactions"
ON public.lead_interactions FOR INSERT
WITH CHECK (false);

-- 2. RPC anônima para registrar interação (rate-limit por hash UA + provider 1/min)
CREATE OR REPLACE FUNCTION public.track_lead_interaction(
  _provider_id UUID,
  _service_id UUID,
  _type TEXT,
  _source TEXT,
  _ua_hash TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_recent INT;
BEGIN
  IF _type NOT IN ('whatsapp','phone','profile','click','share') THEN
    RAISE EXCEPTION 'invalid interaction_type';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = _provider_id) THEN
    RAISE EXCEPTION 'provider not found';
  END IF;

  -- Rate-limit simples: máx 1 evento do mesmo tipo+UA+provider por minuto
  IF _ua_hash IS NOT NULL THEN
    SELECT COUNT(*) INTO v_recent
    FROM public.lead_interactions
    WHERE provider_id = _provider_id
      AND interaction_type = _type
      AND ua_hash = _ua_hash
      AND created_at > now() - interval '1 minute';
    IF v_recent > 0 THEN RETURN NULL; END IF;
  END IF;

  INSERT INTO public.lead_interactions(provider_id, service_id, interaction_type, source, ua_hash)
  VALUES (_provider_id, _service_id, _type, _source, _ua_hash)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_lead_interaction(UUID, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 3. Stats agregadas (somente para o dono ou admin)
CREATE OR REPLACE FUNCTION public.get_provider_lead_stats(_provider_id UUID)
RETURNS TABLE(
  clicks_7d INT,
  clicks_30d INT,
  whatsapp_7d INT,
  whatsapp_30d INT,
  phone_7d INT,
  phone_30d INT,
  last_click_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM providers WHERE id = _provider_id AND user_id = auth.uid())
    OR has_role(auth.uid(), 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::INT,
    COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::INT,
    COUNT(*) FILTER (WHERE interaction_type='whatsapp' AND created_at > now() - interval '7 days')::INT,
    COUNT(*) FILTER (WHERE interaction_type='whatsapp' AND created_at > now() - interval '30 days')::INT,
    COUNT(*) FILTER (WHERE interaction_type='phone' AND created_at > now() - interval '7 days')::INT,
    COUNT(*) FILTER (WHERE interaction_type='phone' AND created_at > now() - interval '30 days')::INT,
    MAX(created_at)
  FROM lead_interactions
  WHERE provider_id = _provider_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_lead_stats(UUID) TO authenticated;

-- 4. Activity heartbeat
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_providers_last_active
  ON public.providers(last_active_at DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.touch_provider_last_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'providers' THEN
    NEW.last_active_at := now();
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'services' THEN
    UPDATE public.providers SET last_active_at = now()
    WHERE user_id = NEW.user_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_provider_last_active_self ON public.providers;
CREATE TRIGGER trg_touch_provider_last_active_self
BEFORE UPDATE ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.touch_provider_last_active();

DROP TRIGGER IF EXISTS trg_touch_provider_last_active_service ON public.services;
CREATE TRIGGER trg_touch_provider_last_active_service
AFTER INSERT OR UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.touch_provider_last_active();

-- RPC para o cliente chamar no login/heartbeat sem update direto
CREATE OR REPLACE FUNCTION public.touch_my_provider_activity()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.providers
  SET last_active_at = now()
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_my_provider_activity() TO authenticated;