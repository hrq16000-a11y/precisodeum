
-- ============================================================
-- PASSO 3: Endurecimento de contact_clicks e search_intent_log
-- ============================================================

-- ---------- 3.1 RPC: log_contact_click ----------
CREATE OR REPLACE FUNCTION public.log_contact_click(
  _provider_id uuid,
  _contact_type text DEFAULT 'whatsapp',
  _page_path text DEFAULT NULL,
  _visitor_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_identifier text;
  v_allowed boolean;
BEGIN
  -- Validação de tipo
  IF _contact_type IS NULL OR _contact_type NOT IN ('whatsapp','phone','profile','share') THEN
    RETURN NULL;
  END IF;

  -- Validação de existência do prestador
  IF _provider_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.providers WHERE id = _provider_id AND deleted_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  -- Sanitização leve
  IF _page_path IS NOT NULL AND length(_page_path) > 500 THEN
    _page_path := substring(_page_path, 1, 500);
  END IF;
  IF _visitor_id IS NOT NULL AND length(_visitor_id) > 120 THEN
    _visitor_id := substring(_visitor_id, 1, 120);
  END IF;

  -- Rate limit best-effort (não quebra UX)
  v_identifier := coalesce(auth.uid()::text, _visitor_id, 'anon');
  BEGIN
    v_allowed := public.check_rate_limit(
      'contact_click:' || v_identifier,
      60,   -- 60 cliques
      60    -- por 60 minutos
    );
    IF NOT coalesce(v_allowed, true) THEN
      RETURN NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Se rate_limit falhar, segue best-effort
    NULL;
  END;

  INSERT INTO public.contact_clicks (
    provider_id, contact_type, page_path, visitor_id
  ) VALUES (
    _provider_id, _contact_type, _page_path, _visitor_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_contact_click(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.log_contact_click(uuid, text, text, text) TO anon, authenticated;

-- ---------- 3.2 RPC: log_search_intent ----------
CREATE OR REPLACE FUNCTION public.log_search_intent(
  _category_slug text DEFAULT NULL,
  _category_name text DEFAULT NULL,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _visitor_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_identifier text;
  v_allowed boolean;
BEGIN
  -- Validações de tamanho
  IF _category_slug IS NOT NULL AND length(_category_slug) > 120 THEN
    RETURN NULL;
  END IF;
  IF _category_name IS NOT NULL AND length(_category_name) > 120 THEN
    RETURN NULL;
  END IF;
  IF _city IS NOT NULL AND length(_city) > 120 THEN
    RETURN NULL;
  END IF;
  IF _state IS NOT NULL AND length(_state) > 2 THEN
    RETURN NULL;
  END IF;
  IF _visitor_id IS NOT NULL AND length(_visitor_id) > 120 THEN
    _visitor_id := substring(_visitor_id, 1, 120);
  END IF;

  -- Rate limit best-effort
  v_identifier := coalesce(auth.uid()::text, _visitor_id, 'anon');
  BEGIN
    v_allowed := public.check_rate_limit(
      'search_intent:' || v_identifier,
      120,  -- 120 registros
      60    -- por 60 minutos
    );
    IF NOT coalesce(v_allowed, true) THEN
      RETURN NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.search_intent_log (
    category_slug, category_name, city, state, visitor_id, user_id
  ) VALUES (
    _category_slug, _category_name, _city, _state, _visitor_id, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_search_intent(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.log_search_intent(text, text, text, text, text) TO anon, authenticated;

-- ---------- 3.3 Trocar policies permissivas por bloqueio ----------

-- contact_clicks
DROP POLICY IF EXISTS "Anyone can log contact clicks" ON public.contact_clicks;
CREATE POLICY "Deny direct inserts on contact_clicks"
  ON public.contact_clicks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- search_intent_log
DROP POLICY IF EXISTS "Anyone can log search intent" ON public.search_intent_log;
CREATE POLICY "Deny direct inserts on search_intent_log"
  ON public.search_intent_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- Garantia: revogar INSERT direto via grant (RPC roda como definer e ignora isso)
REVOKE INSERT ON public.contact_clicks FROM anon, authenticated;
REVOKE INSERT ON public.search_intent_log FROM anon, authenticated;
