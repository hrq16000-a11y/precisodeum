
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
  IF _path IS NULL OR length(_path) = 0 THEN
    RETURN NULL;
  END IF;
  IF _code IS NULL OR _code NOT IN (400,401,403,404,408,429,500,502,503,504) THEN
    RETURN NULL;
  END IF;

  IF length(_path) > 2000 THEN _path := substring(_path, 1, 2000); END IF;
  IF _referrer IS NOT NULL AND length(_referrer) > 500 THEN _referrer := substring(_referrer, 1, 500); END IF;
  IF _user_agent IS NOT NULL AND length(_user_agent) > 500 THEN _user_agent := substring(_user_agent, 1, 500); END IF;
  IF _visitor_id IS NOT NULL AND length(_visitor_id) > 120 THEN _visitor_id := substring(_visitor_id, 1, 120); END IF;

  v_identifier := coalesce(v_uid::text, _visitor_id, 'anon');
  BEGIN
    v_allowed := public.check_rate_limit('error_page_event', v_identifier, 20, 60);
    IF NOT coalesce(v_allowed, true) THEN
      RETURN NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.error_page_events (path, code, referrer, user_id, user_agent)
    VALUES (_path, _code, _referrer, v_uid, _user_agent)
    RETURNING id INTO v_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  RETURN v_id;
END;
$$;
