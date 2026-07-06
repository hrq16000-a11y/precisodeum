-- Patch: reject calls when auth.uid() IS NULL (fixes NULL-comparison hole).
-- Só reescreve o bloco de guard; corpo funcional intacto.
BEGIN;

-- Helper local (inline em cada função para não criar dependência nova).

-- 1) get_contact_impact_24h
CREATE OR REPLACE FUNCTION public.get_contact_impact_24h(_user_id uuid)
 RETURNS TABLE(total_views bigint, whatsapp_clicks bigint, phone_clicks bigint, unique_visitors bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL
     OR (_user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT COUNT(*)::bigint,
           COUNT(*) FILTER (WHERE contact_type = 'whatsapp')::bigint,
           COUNT(*) FILTER (WHERE contact_type = 'phone')::bigint,
           COUNT(DISTINCT visitor_id)::bigint
      FROM public.contact_clicks cc
      JOIN public.providers p ON p.id = cc.provider_id
     WHERE p.user_id = _user_id
       AND cc.created_at >= now() - interval '24 hours';
END;
$function$;

-- 2) get_provider_activity_signals
CREATE OR REPLACE FUNCTION public.get_provider_activity_signals(_user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _working_now boolean := false;
  _active_today boolean := false;
  _last_signal_at timestamptz := NULL;
  _has_daily_post boolean := false;
  _closed_lead_24h boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('working_now', false, 'active_today', false);
  END IF;
  IF _user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  BEGIN
    SELECT TRUE, MAX(last_heartbeat_at) INTO _working_now, _last_signal_at
      FROM public.provider_presence_sessions
     WHERE provider_id = _user_id AND ended_at IS NULL
       AND last_heartbeat_at > now() - interval '5 minutes'
     LIMIT 1;
  EXCEPTION WHEN undefined_table THEN _working_now := false; END;

  BEGIN
    SELECT EXISTS (SELECT 1 FROM public.daily_posts
       WHERE provider_id = _user_id AND created_at >= date_trunc('day', now()))
      INTO _has_daily_post;
  EXCEPTION WHEN undefined_table THEN _has_daily_post := false; END;

  BEGIN
    SELECT EXISTS (SELECT 1 FROM public.leads
       WHERE provider_id = _user_id
         AND status IN ('completed','won','closed','concluded')
         AND COALESCE(updated_at, created_at) > now() - interval '24 hours')
      INTO _closed_lead_24h;
  EXCEPTION WHEN undefined_table THEN _closed_lead_24h := false; END;

  _active_today := COALESCE(_working_now,false) OR _has_daily_post OR _closed_lead_24h;

  RETURN jsonb_build_object(
    'working_now', COALESCE(_working_now,false),
    'active_today', COALESCE(_active_today,false),
    'has_daily_post', COALESCE(_has_daily_post,false),
    'closed_lead_24h', COALESCE(_closed_lead_24h,false),
    'last_signal_at', _last_signal_at
  );
END;
$function$;

-- 3) get_provider_verification_status
CREATE OR REPLACE FUNCTION public.get_provider_verification_status(_user_id uuid)
 RETURNS TABLE(account_age_ok boolean, onboarding_ok boolean, conversion_ok boolean, is_verified boolean, account_age_days integer, verified_since timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_provider RECORD;
  v_profile RECORD;
  v_age_days INT;
  v_onb BOOLEAN;
  v_conv BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL
     OR (_user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id, created_at, community_verified, community_verified_at
    INTO v_provider FROM public.providers WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, false, false, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT onboarding_checklist_completed_at INTO v_profile
    FROM public.profiles WHERE id = _user_id;

  v_age_days := EXTRACT(DAY FROM (now() - v_provider.created_at));
  v_onb := v_profile.onboarding_checklist_completed_at IS NOT NULL;
  v_conv := EXISTS (SELECT 1 FROM public.leads WHERE provider_id = v_provider.id AND status = 'converted')
         OR EXISTS (SELECT 1 FROM public.contact_clicks WHERE provider_id = v_provider.id AND contact_type = 'whatsapp');

  RETURN QUERY SELECT (v_age_days >= 30), v_onb, v_conv,
                      v_provider.community_verified, v_age_days, v_provider.community_verified_at;
END;
$function$;

-- 4) get_user_sponsor_id
CREATE OR REPLACE FUNCTION public.get_user_sponsor_id(_user_id uuid)
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_sponsor_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL
     OR (_user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT sponsor_id INTO v_sponsor_id FROM public.sponsor_contacts
    WHERE user_id = _user_id LIMIT 1;
  RETURN v_sponsor_id;
END;
$function$;

-- 5) suggest_next_contact_slot
CREATE OR REPLACE FUNCTION public.suggest_next_contact_slot(_provider_id uuid, _from_ts timestamp with time zone DEFAULT now())
 RETURNS TABLE(day integer, period text, iso_date date)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_hours jsonb;
  v_tz text;
  v_days jsonb;
  v_periods jsonb;
  v_local timestamptz;
  v_local_date date;
  v_local_hour int;
  v_period_order text[] := ARRAY['morning','afternoon','evening'];
  v_offset int;
  v_candidate_date date;
  v_candidate_dow int;
  v_period text;
  v_period_idx int;
  v_today_min_idx int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT user_id, contact_hours INTO v_owner, v_hours
    FROM public.providers WHERE id = _provider_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_owner <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_hours IS NULL THEN RETURN; END IF;

  v_tz := COALESCE(v_hours->>'timezone','America/Sao_Paulo');
  v_days := COALESCE(v_hours->'days','[]'::jsonb);
  v_periods := COALESCE(v_hours->'periods','[]'::jsonb);
  IF jsonb_array_length(v_days) = 0 OR jsonb_array_length(v_periods) = 0 THEN RETURN; END IF;

  v_local := _from_ts AT TIME ZONE v_tz;
  v_local_date := v_local::date;
  v_local_hour := EXTRACT(HOUR FROM v_local)::int;

  IF v_local_hour < 12 THEN v_today_min_idx := 0;
  ELSIF v_local_hour < 18 THEN v_today_min_idx := 1;
  ELSIF v_local_hour < 21 THEN v_today_min_idx := 2;
  ELSE v_today_min_idx := 3;
  END IF;

  FOR v_offset IN 0..14 LOOP
    v_candidate_date := v_local_date + v_offset;
    v_candidate_dow := EXTRACT(DOW FROM v_candidate_date)::int;
    IF NOT (v_days @> to_jsonb(v_candidate_dow)) THEN CONTINUE; END IF;
    FOR v_period_idx IN 0..2 LOOP
      v_period := v_period_order[v_period_idx + 1];
      IF v_offset = 0 AND v_period_idx < v_today_min_idx THEN CONTINUE; END IF;
      IF v_periods @> to_jsonb(v_period) THEN
        day := v_candidate_dow; period := v_period; iso_date := v_candidate_date;
        RETURN NEXT; RETURN;
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

COMMIT;