-- =====================================================================
-- Hardening: SECURITY DEFINER guards on 3 critical RPCs
-- =====================================================================

-- 1) award_engagement_points: caller must match _user_id when called
-- directly via PostgREST (pg_trigger_depth() = 0). Internal trigger
-- callers (pg_trigger_depth() > 0) bypass the check, since triggers
-- already gate by RLS-protected source rows (reviews, services, etc.).
CREATE OR REPLACE FUNCTION public.award_engagement_points(_user_id uuid, _action_key text, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rule RECORD;
  v_today_count integer;
  v_last_award timestamptz;
  v_points integer;
  v_new_total integer;
BEGIN
  -- Guard: direct client calls must target the caller themselves.
  -- Triggers (pg_trigger_depth > 0) are trusted internal callers.
  IF pg_trigger_depth() = 0 THEN
    IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
      RAISE EXCEPTION 'unauthorized'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_rule
  FROM score_rules
  WHERE action_key = _action_key AND active = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN 0; END IF;

  v_points := v_rule.points;

  IF v_rule.max_per_day IS NOT NULL AND v_rule.max_per_day > 0 THEN
    SELECT COUNT(*) INTO v_today_count
    FROM engagement_log
    WHERE user_id = _user_id
      AND action_key = _action_key
      AND created_at >= date_trunc('day', now());

    IF v_today_count >= v_rule.max_per_day THEN
      RETURN 0;
    END IF;
  END IF;

  IF v_rule.cooldown_hours IS NOT NULL AND v_rule.cooldown_hours > 0 THEN
    SELECT MAX(created_at) INTO v_last_award
    FROM engagement_log
    WHERE user_id = _user_id
      AND action_key = _action_key;

    IF v_last_award IS NOT NULL AND
       v_last_award > now() - (v_rule.cooldown_hours || ' hours')::interval THEN
      RETURN 0;
    END IF;
  END IF;

  UPDATE profiles
  SET engagement_points = GREATEST(0, engagement_points + v_points)
  WHERE id = _user_id
  RETURNING engagement_points INTO v_new_total;

  INSERT INTO engagement_log (user_id, action_key, points_awarded, metadata)
  VALUES (_user_id, _action_key, v_points, _metadata);

  RETURN COALESCE(v_new_total, 0);
END;
$function$;

-- 2) complete_referral: caller must be the referred user themselves.
CREATE OR REPLACE FUNCTION public.complete_referral(_referred_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ref RECORD;
  v_points INT := 100;
BEGIN
  -- Guard: only the referred user can complete their own referral.
  IF auth.uid() IS NULL OR auth.uid() <> _referred_id THEN
    RAISE EXCEPTION 'unauthorized'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ref FROM referrals WHERE referred_id = _referred_id AND status = 'pending';
  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE profiles SET engagement_points = engagement_points + v_points WHERE id = v_ref.referrer_id;
  UPDATE profiles SET engagement_points = engagement_points + v_points WHERE id = _referred_id;

  INSERT INTO engagement_log (user_id, action_key, points_awarded, metadata)
  VALUES
    (v_ref.referrer_id, 'referral_completed', v_points, jsonb_build_object('referred_id', _referred_id)),
    (_referred_id, 'referral_signup', v_points, jsonb_build_object('referrer_id', v_ref.referrer_id));

  UPDATE referrals
    SET status = 'completed', completed_at = now(), points_awarded = v_points
    WHERE id = v_ref.id;

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (v_ref.referrer_id, 'Indicação completada! +100 pontos',
    'Seu indicado concluiu o cadastro. Você ganhou 100 pontos de engajamento.',
    'gamification', '/dashboard/indicacoes');

  RETURN TRUE;
END;
$function$;

-- 3) distribute_open_lead: caller must own the open lead.
CREATE OR REPLACE FUNCTION public.distribute_open_lead(_open_lead_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead public.open_leads;
  v_count integer := 0;
  v_provider record;
BEGIN
  -- Guard: must be authenticated.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_lead FROM public.open_leads WHERE id = _open_lead_id;
  IF v_lead.id IS NULL THEN
    RETURN 0;
  END IF;

  -- Guard: caller must own the lead (or lead must be unowned/anonymous).
  IF v_lead.client_user_id IS NOT NULL AND v_lead.client_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized'
      USING ERRCODE = '42501';
  END IF;

  FOR v_provider IN
    SELECT p.id AS provider_id, p.user_id
    FROM public.providers p
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.deleted_at IS NULL
      AND p.status = 'active'
      AND (
        v_lead.category_slug IS NULL
        OR EXISTS (
          SELECT 1 FROM public.services s
          JOIN public.categories c ON c.id = s.category_id
          WHERE s.provider_id = p.id AND c.slug = v_lead.category_slug
        )
      )
      AND (v_lead.city = '' OR LOWER(p.city) = LOWER(v_lead.city))
    ORDER BY
      COALESCE(pr.engagement_points, 0) DESC,
      COALESCE(p.rating, 0) DESC,
      COALESCE(p.review_count, 0) DESC
    LIMIT 3
  LOOP
    INSERT INTO public.open_lead_responses (open_lead_id, provider_id, provider_user_id, status)
    VALUES (_open_lead_id, v_provider.provider_id, v_provider.user_id, 'invited')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_provider.user_id,
      'Nova oportunidade de atendimento',
      'Um cliente está procurando ' || COALESCE(v_lead.service_query, 'um serviço') ||
        CASE WHEN v_lead.city <> '' THEN ' em ' || v_lead.city ELSE '' END || '. Clique para responder.',
      'lead',
      '/dashboard/leads-abertos'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;