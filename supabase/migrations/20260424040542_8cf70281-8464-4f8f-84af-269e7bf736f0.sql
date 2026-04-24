-- 1) Rewrite recalculate_engagement_points to read STRICTLY from score_rules
CREATE OR REPLACE FUNCTION public.recalculate_engagement_points(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pts integer := 0;
  prov RECORD;
  prof RECORD;
  lead_count integer := 0;
  -- rule lookups (NULL-safe; if a rule is removed/disabled it simply contributes 0)
  pts_photo integer;
  pts_bio integer;
  pts_first_service integer;
  pts_extra_service integer;
  pts_album integer;
  pts_photo_portfolio integer;
  pts_lead integer;
  pts_review integer;
  pts_basic integer;
  -- caps come from score_rules.max_per_day (interpreted as lifetime cap for cumulative actions)
  cap_extra_service integer;
  cap_album integer;
  cap_photo_portfolio integer;
  cap_lead integer;
  cap_review integer;
BEGIN
  -- Pull rule values dynamically (only active rules contribute)
  SELECT points INTO pts_photo FROM score_rules WHERE action_key='profile_photo_uploaded' AND active LIMIT 1;
  SELECT points INTO pts_bio FROM score_rules WHERE action_key='profile_completed' AND active LIMIT 1;
  SELECT points, max_per_day INTO pts_first_service, cap_extra_service
    FROM score_rules WHERE action_key='service_created' AND active LIMIT 1;
  SELECT points INTO pts_extra_service FROM score_rules WHERE action_key='service_created' AND active LIMIT 1;
  SELECT points, max_per_day INTO pts_album, cap_album FROM score_rules WHERE action_key='onboarding_first_portfolio_album' AND active LIMIT 1;
  SELECT points, max_per_day INTO pts_photo_portfolio, cap_photo_portfolio FROM score_rules WHERE action_key='portfolio_photo_added' AND active LIMIT 1;
  SELECT points, max_per_day INTO pts_lead, cap_lead FROM score_rules WHERE action_key='lead_received' AND active LIMIT 1;
  SELECT points, max_per_day INTO pts_review, cap_review FROM score_rules WHERE action_key='review_received' AND active LIMIT 1;
  SELECT points INTO pts_basic FROM score_rules WHERE action_key='onboarding_basic_complete' AND active LIMIT 1;

  -- Defaults (NULL → 0 contribution)
  pts_photo := COALESCE(pts_photo, 0);
  pts_bio := COALESCE(pts_bio, 0);
  pts_first_service := COALESCE(pts_first_service, 0);
  pts_extra_service := COALESCE(pts_extra_service, 0);
  pts_album := COALESCE(pts_album, 0);
  pts_photo_portfolio := COALESCE(pts_photo_portfolio, 0);
  pts_lead := COALESCE(pts_lead, 0);
  pts_review := COALESCE(pts_review, 0);
  pts_basic := COALESCE(pts_basic, 0);
  cap_extra_service := COALESCE(cap_extra_service, 5);
  cap_album := COALESCE(cap_album, 3);
  cap_photo_portfolio := COALESCE(cap_photo_portfolio, 20);
  cap_lead := COALESCE(cap_lead, 10);
  cap_review := COALESCE(cap_review, 5);

  -- Provider snapshot
  SELECT INTO prov
    p.id, p.photo_url, p.description, p.services_count, p.portfolio_album_count,
    p.portfolio_photo_count, p.review_count
  FROM providers p
  WHERE p.user_id = target_user_id AND p.deleted_at IS NULL
  LIMIT 1;

  SELECT INTO prof avatar_url, full_name, whatsapp FROM profiles WHERE id = target_user_id;

  -- Avatar / photo
  IF (prof.avatar_url IS NOT NULL AND prof.avatar_url <> '')
     OR (prov.photo_url IS NOT NULL AND prov.photo_url <> '') THEN
    pts := pts + pts_photo;
  END IF;

  -- Basic onboarding (name + whatsapp present)
  IF prof.full_name IS NOT NULL AND prof.full_name <> ''
     AND prof.whatsapp IS NOT NULL AND prof.whatsapp <> '' THEN
    pts := pts + pts_basic;
  END IF;

  IF prov.id IS NULL THEN
    UPDATE profiles SET engagement_points = pts WHERE id = target_user_id;
    RETURN pts;
  END IF;

  -- Bio (≥30 chars)
  IF length(COALESCE(prov.description, '')) >= 30 THEN
    pts := pts + pts_bio;
  END IF;

  -- Services: 1st gives full points, extras share the same rule capped at max_per_day
  IF COALESCE(prov.services_count, 0) >= 1 THEN
    pts := pts + pts_first_service
              + LEAST(GREATEST(prov.services_count - 1, 0), GREATEST(cap_extra_service - 1, 0)) * pts_extra_service;
  END IF;

  -- Portfolio
  pts := pts + LEAST(COALESCE(prov.portfolio_album_count, 0), cap_album) * pts_album;
  pts := pts + LEAST(COALESCE(prov.portfolio_photo_count, 0), cap_photo_portfolio) * pts_photo_portfolio;

  -- Leads / reviews
  SELECT COUNT(*) INTO lead_count FROM leads l WHERE l.provider_id = prov.id;
  pts := pts + LEAST(lead_count, cap_lead) * pts_lead;
  pts := pts + LEAST(COALESCE(prov.review_count, 0), cap_review) * pts_review;

  UPDATE profiles SET engagement_points = pts WHERE id = target_user_id;
  RETURN pts;
END;
$function$;

-- 2) Recalculate ALL providers (also covers the 47 zeroed users)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE profile_type = 'provider' LOOP
    PERFORM public.recalculate_engagement_points(r.id);
  END LOOP;
END $$;