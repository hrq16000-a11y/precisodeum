
CREATE OR REPLACE FUNCTION public.recalculate_engagement_points(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    IF has_photo THEN pts := pts + 10; END IF;
    UPDATE profiles SET engagement_points = pts WHERE id = target_user_id;
    RETURN pts;
  END IF;

  IF prov.photo_url IS NOT NULL AND prov.photo_url <> '' THEN
    pts := pts + 10;
  END IF;

  IF length(prov.description) > 50 THEN
    pts := pts + 10;
  END IF;

  IF COALESCE(prov.services_count, 0) >= 1 THEN
    pts := pts + 15 + (LEAST(prov.services_count - 1, 4) * 5);
  END IF;

  pts := pts + LEAST(COALESCE(prov.portfolio_album_count, 0), 3) * 10;
  pts := pts + LEAST(COALESCE(prov.portfolio_photo_count, 0) / 5, 4) * 5;

  SELECT COUNT(*) INTO lead_count FROM leads l WHERE l.provider_id = prov.id;
  pts := pts + LEAST(lead_count, 10) * 3;

  pts := pts + LEAST(COALESCE(prov.review_count, 0), 5) * 5;

  UPDATE profiles SET engagement_points = pts WHERE id = target_user_id;
  RETURN pts;
END;
$$;
