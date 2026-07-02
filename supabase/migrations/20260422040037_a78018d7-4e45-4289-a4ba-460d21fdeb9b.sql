CREATE OR REPLACE FUNCTION public.recalculate_engagement_points(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pts integer := 0;
  prov RECORD;
  lead_count integer;
  has_photo boolean;
BEGIN
  SELECT INTO prov
    p.id, p.photo_url, p.description, p.services_count, p.portfolio_album_count,
    p.portfolio_photo_count, p.review_count
  FROM providers p
  WHERE p.user_id = target_user_id AND p.deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT INTO has_photo (pr.avatar_url IS NOT NULL AND pr.avatar_url <> '')
    FROM profiles pr WHERE pr.id = target_user_id;
    IF has_photo THEN pts := pts + 84; END IF;
    UPDATE profiles SET engagement_points = pts WHERE id = target_user_id;
    RETURN pts;
  END IF;

  IF prov.photo_url IS NOT NULL AND prov.photo_url <> '' THEN
    pts := pts + 84;
  END IF;

  IF length(COALESCE(prov.description, '')) >= 30 THEN
    pts := pts + 46;
  END IF;

  IF COALESCE(prov.services_count, 0) >= 1 THEN
    pts := pts + 113 + (LEAST(prov.services_count - 1, 4) * 18);
  END IF;

  pts := pts + LEAST(COALESCE(prov.portfolio_album_count, 0), 3) * 24;
  pts := pts + LEAST(COALESCE(prov.portfolio_photo_count, 0), 20) * 7;

  SELECT COUNT(*) INTO lead_count FROM leads l WHERE l.provider_id = prov.id;
  pts := pts + LEAST(lead_count, 10) * 9;

  pts := pts + LEAST(COALESCE(prov.review_count, 0), 5) * 11;

  UPDATE profiles SET engagement_points = pts WHERE id = target_user_id;
  RETURN pts;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_user_level(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_points integer;
  v_new_level_id uuid;
  v_old_level_id uuid;
BEGIN
  SELECT engagement_points, level_id
  INTO v_points, v_old_level_id
  FROM profiles
  WHERE id = _user_id;

  IF v_points IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_new_level_id
  FROM gamification_levels
  WHERE active = true AND v_points >= min_points
  ORDER BY min_points DESC
  LIMIT 1;

  IF v_new_level_id IS DISTINCT FROM v_old_level_id AND v_new_level_id IS NOT NULL THEN
    UPDATE profiles SET level_id = v_new_level_id WHERE id = _user_id;
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (_user_id, 'level_changed', 'profile', _user_id::text,
      jsonb_build_object('old_level_id', v_old_level_id, 'new_level_id', v_new_level_id, 'points', v_points));
  END IF;

  RETURN v_new_level_id;
END;
$function$;