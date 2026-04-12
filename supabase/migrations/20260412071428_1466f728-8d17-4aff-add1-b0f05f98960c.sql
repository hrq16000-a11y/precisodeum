
-- Add engagement_points column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS engagement_points integer NOT NULL DEFAULT 0;

-- Create index for sorting by points
CREATE INDEX IF NOT EXISTS idx_profiles_engagement_points ON public.profiles (engagement_points DESC);

-- Function to recalculate engagement points for a given user
CREATE OR REPLACE FUNCTION public.recalculate_engagement_points(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pts integer := 0;
  prov RECORD;
  svc_count integer;
  album_count integer;
  photo_count integer;
  lead_count integer;
  review_count integer;
  has_photo boolean;
  has_desc boolean;
BEGIN
  -- Get provider data
  SELECT INTO prov
    p.photo_url, p.description, p.services_count, p.portfolio_album_count,
    p.portfolio_photo_count, p.review_count
  FROM providers p
  WHERE p.user_id = target_user_id AND p.deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    -- Check profile-level data only
    SELECT INTO has_photo (pr.avatar_url IS NOT NULL AND pr.avatar_url <> '')
    FROM profiles pr WHERE pr.id = target_user_id;

    IF has_photo THEN pts := pts + 10; END IF;

    UPDATE profiles SET engagement_points = pts WHERE id = target_user_id;
    RETURN pts;
  END IF;

  -- Photo (+10)
  IF prov.photo_url IS NOT NULL AND prov.photo_url <> '' THEN
    pts := pts + 10;
  END IF;

  -- Description > 50 chars (+10)
  IF length(prov.description) > 50 THEN
    pts := pts + 10;
  END IF;

  -- Services: first (+15), additional (+5 each, max 4 extra = +20)
  svc_count := COALESCE(prov.services_count, 0);
  IF svc_count >= 1 THEN
    pts := pts + 15 + (LEAST(svc_count - 1, 4) * 5);
  END IF;

  -- Portfolio albums (+10 each, max 3 = +30)
  album_count := COALESCE(prov.portfolio_album_count, 0);
  pts := pts + LEAST(album_count, 3) * 10;

  -- Portfolio photos (+5 per 5 photos, max +20)
  photo_count := COALESCE(prov.portfolio_photo_count, 0);
  pts := pts + LEAST(photo_count / 5, 4) * 5;

  -- Leads received (+3 each, max +30)
  SELECT COUNT(*) INTO lead_count FROM leads l
  WHERE l.provider_id = prov.id;
  pts := pts + LEAST(lead_count, 10) * 3;

  -- Reviews (+5 each, max +25)
  pts := pts + LEAST(COALESCE(prov.review_count, 0), 5) * 5;

  -- Update
  UPDATE profiles SET engagement_points = pts WHERE id = target_user_id;
  RETURN pts;
END;
$$;

-- Trigger function: recalculate on provider changes
CREATE OR REPLACE FUNCTION public.trg_recalc_engagement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM recalculate_engagement_points(NEW.user_id);
  RETURN NEW;
END;
$$;

-- Trigger on providers update
DROP TRIGGER IF EXISTS trg_engagement_on_provider ON public.providers;
CREATE TRIGGER trg_engagement_on_provider
AFTER INSERT OR UPDATE ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.trg_recalc_engagement();

-- Admin function to manually adjust points
CREATE OR REPLACE FUNCTION public.admin_adjust_points(target_user_id uuid, point_delta integer, reset_to_zero boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_pts integer;
BEGIN
  IF reset_to_zero THEN
    UPDATE profiles SET engagement_points = 0 WHERE id = target_user_id;
    RETURN 0;
  END IF;

  UPDATE profiles
  SET engagement_points = GREATEST(0, engagement_points + point_delta)
  WHERE id = target_user_id
  RETURNING engagement_points INTO new_pts;

  RETURN COALESCE(new_pts, 0);
END;
$$;
