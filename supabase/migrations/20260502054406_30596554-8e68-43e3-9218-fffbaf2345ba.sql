CREATE OR REPLACE FUNCTION public.record_registration_snapshot(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT id INTO _existing FROM public.registration_snapshots WHERE user_id = _uid;
  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  INSERT INTO public.registration_snapshots (
    user_id,
    signup_method, signup_referrer,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    landing_url, came_from_link,
    ip_address, isp, country, region, city_geoip,
    latitude, longitude, accuracy_m, was_moving, velocity_mps,
    postal_code, street, street_number, neighborhood, city, state,
    whatsapp, email,
    user_agent, device_brand, device_model, device_imei,
    os_name, os_version, browser_name, browser_version,
    screen_width, screen_height, device_pixel_ratio,
    language, timezone,
    battery_level, battery_charging, online_at_signup,
    device_fingerprint,
    origin_summary, raw_meta,
    connection_type, connection_downlink_mbps, connection_rtt_ms,
    terms_version, terms_accepted_at
  ) VALUES (
    _uid,
    _payload->>'signup_method', _payload->>'signup_referrer',
    _payload->>'utm_source', _payload->>'utm_medium', _payload->>'utm_campaign', _payload->>'utm_term', _payload->>'utm_content',
    _payload->>'landing_url', COALESCE((_payload->>'came_from_link')::boolean, false),
    _payload->>'ip_address', _payload->>'isp', _payload->>'country', _payload->>'region', _payload->>'city_geoip',
    NULLIF(_payload->>'latitude','')::double precision,
    NULLIF(_payload->>'longitude','')::double precision,
    NULLIF(_payload->>'accuracy_m','')::double precision,
    NULLIF(_payload->>'was_moving','')::boolean,
    NULLIF(_payload->>'velocity_mps','')::double precision,
    _payload->>'postal_code', _payload->>'street', _payload->>'street_number',
    _payload->>'neighborhood', _payload->>'city', _payload->>'state',
    _payload->>'whatsapp', _payload->>'email',
    _payload->>'user_agent', _payload->>'device_brand', _payload->>'device_model', _payload->>'device_imei',
    _payload->>'os_name', _payload->>'os_version', _payload->>'browser_name', _payload->>'browser_version',
    NULLIF(_payload->>'screen_width','')::int,
    NULLIF(_payload->>'screen_height','')::int,
    NULLIF(_payload->>'device_pixel_ratio','')::numeric,
    _payload->>'language', _payload->>'timezone',
    NULLIF(_payload->>'battery_level','')::numeric,
    NULLIF(_payload->>'battery_charging','')::boolean,
    NULLIF(_payload->>'online_at_signup','')::boolean,
    _payload->>'device_fingerprint',
    COALESCE(_payload->'origin_summary', '{}'::jsonb),
    COALESCE(_payload->'raw_meta', '{}'::jsonb),
    _payload->>'connection_type',
    NULLIF(_payload->>'connection_downlink_mbps','')::numeric,
    NULLIF(_payload->>'connection_rtt_ms','')::int,
    _payload->>'terms_version',
    NULLIF(_payload->>'terms_accepted_at','')::timestamptz
  ) RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$function$;