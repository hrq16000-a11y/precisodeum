CREATE OR REPLACE FUNCTION public.get_provider_activity_signals(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _working_now boolean := false;
  _active_today boolean := false;
  _last_signal_at timestamptz := NULL;
  _has_daily_post boolean := false;
  _closed_lead_24h boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('working_now', false, 'active_today', false);
  END IF;

  BEGIN
    SELECT TRUE, MAX(last_heartbeat_at)
      INTO _working_now, _last_signal_at
      FROM public.provider_presence_sessions
     WHERE provider_id = _user_id
       AND ended_at IS NULL
       AND last_heartbeat_at > now() - interval '5 minutes'
     LIMIT 1;
  EXCEPTION WHEN undefined_table THEN
    _working_now := false;
  END;

  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.daily_posts
       WHERE provider_id = _user_id
         AND created_at >= date_trunc('day', now())
    ) INTO _has_daily_post;
  EXCEPTION WHEN undefined_table THEN
    _has_daily_post := false;
  END;

  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.leads
       WHERE provider_id = _user_id
         AND status IN ('completed', 'won', 'closed', 'concluded')
         AND COALESCE(updated_at, created_at) > now() - interval '24 hours'
    ) INTO _closed_lead_24h;
  EXCEPTION WHEN undefined_table THEN
    _closed_lead_24h := false;
  END;

  _active_today := COALESCE(_working_now, false) OR _has_daily_post OR _closed_lead_24h;

  RETURN jsonb_build_object(
    'working_now', COALESCE(_working_now, false),
    'active_today', COALESCE(_active_today, false),
    'has_daily_post', COALESCE(_has_daily_post, false),
    'closed_lead_24h', COALESCE(_closed_lead_24h, false),
    'last_signal_at', _last_signal_at
  );
END;
$function$;