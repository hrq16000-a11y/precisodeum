
-- =============================================
-- FASE 3: Motor de Gamificação Automático
-- =============================================

-- 1. Tabela de log de engajamento (trilha de auditoria de pontos)
CREATE TABLE IF NOT EXISTS public.engagement_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  points_awarded integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_engagement_log_user_date ON public.engagement_log (user_id, created_at DESC);
CREATE INDEX idx_engagement_log_action ON public.engagement_log (action_key, user_id, created_at);

ALTER TABLE public.engagement_log ENABLE ROW LEVEL SECURITY;

-- Admins can read all, users can read their own
CREATE POLICY "Users can view own engagement log"
  ON public.engagement_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all engagement logs"
  ON public.engagement_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert engagement logs"
  ON public.engagement_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. Core function: Award engagement points with limits
CREATE OR REPLACE FUNCTION public.award_engagement_points(
  _user_id uuid,
  _action_key text,
  _metadata jsonb DEFAULT '{}'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rule RECORD;
  v_today_count integer;
  v_last_award timestamptz;
  v_points integer;
  v_new_total integer;
BEGIN
  -- Look up the score rule
  SELECT * INTO v_rule
  FROM score_rules
  WHERE action_key = _action_key AND active = true
  LIMIT 1;

  -- No rule found or inactive → skip
  IF NOT FOUND THEN RETURN 0; END IF;

  v_points := v_rule.points;

  -- Check max_per_day limit
  IF v_rule.max_per_day IS NOT NULL AND v_rule.max_per_day > 0 THEN
    SELECT COUNT(*) INTO v_today_count
    FROM engagement_log
    WHERE user_id = _user_id
      AND action_key = _action_key
      AND created_at >= date_trunc('day', now());

    IF v_today_count >= v_rule.max_per_day THEN
      RETURN 0; -- Daily limit reached
    END IF;
  END IF;

  -- Check cooldown_hours
  IF v_rule.cooldown_hours IS NOT NULL AND v_rule.cooldown_hours > 0 THEN
    SELECT MAX(created_at) INTO v_last_award
    FROM engagement_log
    WHERE user_id = _user_id
      AND action_key = _action_key;

    IF v_last_award IS NOT NULL AND
       v_last_award > now() - (v_rule.cooldown_hours || ' hours')::interval THEN
      RETURN 0; -- Still in cooldown
    END IF;
  END IF;

  -- Award points
  UPDATE profiles
  SET engagement_points = GREATEST(0, engagement_points + v_points)
  WHERE id = _user_id
  RETURNING engagement_points INTO v_new_total;

  -- Log the award
  INSERT INTO engagement_log (user_id, action_key, points_awarded, metadata)
  VALUES (_user_id, _action_key, v_points, _metadata);

  RETURN COALESCE(v_new_total, 0);
END;
$$;

-- 3. Function: Calculate and update user level based on points
CREATE OR REPLACE FUNCTION public.calculate_user_level(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Find matching level (highest min_points that user qualifies for)
  SELECT id INTO v_new_level_id
  FROM gamification_levels
  WHERE active = true AND v_points >= min_points
  ORDER BY min_points DESC
  LIMIT 1;

  -- Update if level changed
  IF v_new_level_id IS DISTINCT FROM v_old_level_id AND v_new_level_id IS NOT NULL THEN
    UPDATE profiles
    SET level_id = v_new_level_id
    WHERE id = _user_id;

    -- Audit log for level change
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (
      _user_id, 'level_changed', 'profile', _user_id::text,
      jsonb_build_object(
        'old_level_id', v_old_level_id,
        'new_level_id', v_new_level_id,
        'points', v_points
      )
    );
  END IF;

  RETURN v_new_level_id;
END;
$$;

-- 4. Trigger: Auto-recalculate level when engagement_points changes
CREATE OR REPLACE FUNCTION public.trg_auto_level_on_points_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.engagement_points IS DISTINCT FROM OLD.engagement_points THEN
    PERFORM calculate_user_level(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_level_on_points ON public.profiles;
CREATE TRIGGER trg_auto_level_on_points
  AFTER UPDATE OF engagement_points ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_level_on_points_change();

-- 5. Triggers: Listen to user actions and award points

-- 5a. Service created → award points
CREATE OR REPLACE FUNCTION public.trg_award_service_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM providers WHERE id = NEW.provider_id AND deleted_at IS NULL;
  IF v_user_id IS NOT NULL THEN
    PERFORM award_engagement_points(v_user_id, 'service_created',
      jsonb_build_object('service_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gamify_service_created ON public.services;
CREATE TRIGGER trg_gamify_service_created
  AFTER INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_award_service_created();

-- 5b. Portfolio photo added → award points
CREATE OR REPLACE FUNCTION public.trg_award_portfolio_photo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_provider_id uuid;
BEGIN
  SELECT provider_id INTO v_provider_id FROM portfolio_albums WHERE id = NEW.album_id;
  IF v_provider_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id FROM providers WHERE id = v_provider_id AND deleted_at IS NULL;
    IF v_user_id IS NOT NULL THEN
      PERFORM award_engagement_points(v_user_id, 'portfolio_photo_added',
        jsonb_build_object('photo_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gamify_portfolio_photo ON public.portfolio_photos;
CREATE TRIGGER trg_gamify_portfolio_photo
  AFTER INSERT ON public.portfolio_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_award_portfolio_photo();

-- 5c. Review received → award points (5-star bonus)
CREATE OR REPLACE FUNCTION public.trg_award_review_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_action text;
BEGIN
  SELECT user_id INTO v_user_id FROM providers WHERE id = NEW.provider_id AND deleted_at IS NULL;
  IF v_user_id IS NOT NULL THEN
    -- Base review points
    PERFORM award_engagement_points(v_user_id, 'review_received',
      jsonb_build_object('review_id', NEW.id, 'rating', NEW.rating));

    -- Bonus for 5-star review
    IF NEW.rating = 5 THEN
      PERFORM award_engagement_points(v_user_id, 'review_5_stars',
        jsonb_build_object('review_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gamify_review ON public.reviews;
CREATE TRIGGER trg_gamify_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_award_review_received();

-- 5d. Lead received → award points
CREATE OR REPLACE FUNCTION public.trg_award_lead_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM providers WHERE id = NEW.provider_id AND deleted_at IS NULL;
  IF v_user_id IS NOT NULL THEN
    PERFORM award_engagement_points(v_user_id, 'lead_received',
      jsonb_build_object('lead_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gamify_lead ON public.leads;
CREATE TRIGGER trg_gamify_lead
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_award_lead_received();

-- 5e. Profile photo uploaded → award points
CREATE OR REPLACE FUNCTION public.trg_award_profile_photo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.avatar_url IS DISTINCT FROM NEW.avatar_url
     AND NEW.avatar_url IS NOT NULL AND NEW.avatar_url != '' THEN
    PERFORM award_engagement_points(NEW.id, 'profile_photo_uploaded',
      jsonb_build_object('avatar_url', LEFT(NEW.avatar_url, 100)));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gamify_profile_photo ON public.profiles;
CREATE TRIGGER trg_gamify_profile_photo
  AFTER UPDATE OF avatar_url ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_award_profile_photo();

-- 5f. Profile description completed → award points
CREATE OR REPLACE FUNCTION public.trg_award_profile_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_provider boolean;
BEGIN
  -- Check if provider has description > 50 chars (newly filled)
  IF NEW.id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM providers
      WHERE user_id = NEW.id AND deleted_at IS NULL
        AND description IS NOT NULL AND LENGTH(description) > 50
    ) INTO v_has_provider;

    IF v_has_provider AND (
      OLD.full_name IS DISTINCT FROM NEW.full_name
      OR OLD.phone IS DISTINCT FROM NEW.phone
      OR OLD.whatsapp IS DISTINCT FROM NEW.whatsapp
    ) THEN
      PERFORM award_engagement_points(NEW.id, 'profile_completed',
        jsonb_build_object('field_changed', 'profile_data'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gamify_profile_complete ON public.profiles;
CREATE TRIGGER trg_gamify_profile_complete
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_award_profile_complete();

-- 6. Update nearby_providers to factor in gamification level priority
CREATE OR REPLACE FUNCTION public.nearby_providers(
  _lat double precision,
  _lng double precision,
  _radius_m integer DEFAULT 50000,
  _category_slug text DEFAULT NULL,
  _limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid, slug text, business_name text,
  category_name text, category_slug text, category_icon text,
  city text, state text, neighborhood text,
  latitude numeric, longitude numeric, distance_m double precision,
  rating_avg numeric, review_count integer, photo_url text,
  plan text, featured boolean, user_id uuid,
  phone text, whatsapp text, description text,
  years_experience integer, services_count integer,
  portfolio_album_count integer, portfolio_photo_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  ref_point geography;
BEGIN
  ref_point := ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography;
  
  RETURN QUERY
  SELECT
    p.id, p.slug, p.business_name,
    c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
    p.city, p.state, p.neighborhood,
    p.latitude, p.longitude,
    ST_Distance(p.geog, ref_point) AS distance_m,
    p.rating_avg, p.review_count, p.photo_url,
    p.plan, p.featured, p.user_id,
    p.phone, p.whatsapp, p.description,
    p.years_experience, p.services_count,
    p.portfolio_album_count, p.portfolio_photo_count
  FROM providers p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN profiles pr ON pr.id = p.user_id
  LEFT JOIN gamification_levels gl ON gl.id = pr.level_id
  WHERE p.status = 'approved'
    AND p.deleted_at IS NULL
    AND p.geog IS NOT NULL
    AND ST_DWithin(p.geog, ref_point, _radius_m)
    AND (_category_slug IS NULL OR c.slug = _category_slug)
  ORDER BY
    COALESCE(gl.priority, 0) DESC,  -- Higher level = higher priority
    p.featured DESC,
    distance_m ASC
  LIMIT _limit;
END;
$$;
