
-- =========================================================================
-- log_error_page_event
-- =========================================================================
CREATE OR REPLACE FUNCTION public.log_error_page_event(
  _path text,
  _code integer,
  _referrer text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _visitor_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_identifier text;
  v_allowed boolean;
  v_uid uuid := auth.uid();
BEGIN
  -- Validação de path
  IF _path IS NULL OR length(_path) = 0 THEN
    RETURN NULL;
  END IF;

  -- Validação de código HTTP permitido
  IF _code IS NULL OR _code NOT IN (400,401,403,404,408,429,500,502,503,504) THEN
    RETURN NULL;
  END IF;

  -- Truncamentos
  IF length(_path) > 2000 THEN
    _path := substring(_path, 1, 2000);
  END IF;
  IF _referrer IS NOT NULL AND length(_referrer) > 500 THEN
    _referrer := substring(_referrer, 1, 500);
  END IF;
  IF _user_agent IS NOT NULL AND length(_user_agent) > 500 THEN
    _user_agent := substring(_user_agent, 1, 500);
  END IF;
  IF _visitor_id IS NOT NULL AND length(_visitor_id) > 120 THEN
    _visitor_id := substring(_visitor_id, 1, 120);
  END IF;

  -- Rate limit best-effort
  v_identifier := coalesce(v_uid::text, _visitor_id, 'anon');
  BEGIN
    v_allowed := public.check_rate_limit(
      'error_page_event:' || v_identifier,
      _identifier := v_identifier,
      _max_attempts := 20,
      _window_minutes := 60
    );
    -- ajuste: check_rate_limit assinatura é (action, identifier, max, window)
  EXCEPTION WHEN OTHERS THEN
    v_allowed := true;
  END;

  BEGIN
    v_allowed := public.check_rate_limit(
      'error_page_event',
      v_identifier,
      20,
      60
    );
    IF NOT coalesce(v_allowed, true) THEN
      RETURN NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.error_page_events (
      path, code, referrer, user_id, user_agent
    ) VALUES (
      _path, _code, _referrer, v_uid, _user_agent
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_error_page_event(text, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_error_page_event(text, integer, text, text, text) TO anon, authenticated;

-- =========================================================================
-- log_exit_intent_event
-- =========================================================================
CREATE OR REPLACE FUNCTION public.log_exit_intent_event(
  _kind text,
  _pathname text,
  _page_kind text DEFAULT NULL,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _neighborhood text DEFAULT NULL,
  _source text DEFAULT NULL,
  _session_id text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb,
  _visitor_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_identifier text;
  v_allowed boolean;
  v_uid uuid := auth.uid();
BEGIN
  -- Obrigatórios
  IF _kind IS NULL OR length(_kind) = 0 OR length(_kind) > 50 THEN
    RETURN NULL;
  END IF;
  IF _pathname IS NULL OR length(_pathname) = 0 THEN
    RETURN NULL;
  END IF;

  -- Truncamentos
  IF length(_pathname) > 2000 THEN
    _pathname := substring(_pathname, 1, 2000);
  END IF;
  IF _page_kind IS NOT NULL AND length(_page_kind) > 120 THEN
    _page_kind := substring(_page_kind, 1, 120);
  END IF;
  IF _city IS NOT NULL AND length(_city) > 120 THEN
    _city := substring(_city, 1, 120);
  END IF;
  IF _state IS NOT NULL AND length(_state) > 2 THEN
    _state := substring(_state, 1, 2);
  END IF;
  IF _neighborhood IS NOT NULL AND length(_neighborhood) > 120 THEN
    _neighborhood := substring(_neighborhood, 1, 120);
  END IF;
  IF _source IS NOT NULL AND length(_source) > 120 THEN
    _source := substring(_source, 1, 120);
  END IF;
  IF _user_agent IS NOT NULL AND length(_user_agent) > 500 THEN
    _user_agent := substring(_user_agent, 1, 500);
  END IF;
  IF _session_id IS NOT NULL AND length(_session_id) > 120 THEN
    _session_id := substring(_session_id, 1, 120);
  END IF;
  IF _visitor_id IS NOT NULL AND length(_visitor_id) > 120 THEN
    _visitor_id := substring(_visitor_id, 1, 120);
  END IF;
  IF _meta IS NULL THEN
    _meta := '{}'::jsonb;
  END IF;

  -- Rate limit best-effort
  v_identifier := coalesce(v_uid::text, _session_id, _visitor_id, 'anon');
  BEGIN
    v_allowed := public.check_rate_limit(
      'exit_intent_event',
      v_identifier,
      30,
      60
    );
    IF NOT coalesce(v_allowed, true) THEN
      RETURN NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.exit_intent_events (
      kind, pathname, page_kind, city, state, neighborhood,
      source, user_id, session_id, user_agent, meta
    ) VALUES (
      _kind, _pathname, _page_kind, _city, _state, _neighborhood,
      _source, v_uid, _session_id, _user_agent, _meta
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_exit_intent_event(text, text, text, text, text, text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_exit_intent_event(text, text, text, text, text, text, text, text, text, jsonb, text) TO anon, authenticated;

-- =========================================================================
-- Lockdown — REVOKE direct INSERTs and replace permissive policies
-- =========================================================================
DROP POLICY IF EXISTS "Anyone can log error page events" ON public.error_page_events;
DROP POLICY IF EXISTS "exit_intent_events_insert_anyone" ON public.exit_intent_events;

CREATE POLICY "Deny direct inserts on error_page_events"
  ON public.error_page_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Deny direct inserts on exit_intent_events"
  ON public.exit_intent_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

REVOKE INSERT ON public.error_page_events FROM anon, authenticated;
REVOKE INSERT ON public.exit_intent_events FROM anon, authenticated;
