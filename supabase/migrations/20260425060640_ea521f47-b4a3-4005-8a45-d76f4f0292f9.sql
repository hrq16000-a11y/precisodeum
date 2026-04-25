-- =====================================================================
-- Sub-batch 4.5/4.6: Activity signals (Working Now / Active Today)
-- + Full referrals history & ranking
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) get_provider_activity_signals(_user_id)
--    Lightweight: detects if a provider posted Obra do Dia today,
--    closed a lead in last 24h, or has an active presence session
--    (heartbeat in last 5 minutes).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_provider_activity_signals(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Working now: heartbeat session ended_at NULL and last_seen_at within 5 minutes
  -- (table provider_presence_sessions created in 4.2)
  BEGIN
    SELECT TRUE, MAX(last_seen_at)
      INTO _working_now, _last_signal_at
      FROM public.provider_presence_sessions
     WHERE provider_id = _user_id
       AND ended_at IS NULL
       AND last_seen_at > now() - interval '5 minutes'
     LIMIT 1;
  EXCEPTION WHEN undefined_table THEN
    _working_now := false;
  END;

  -- Active today: posted Obra do Dia today
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.daily_posts
       WHERE provider_id = _user_id
         AND created_at >= date_trunc('day', now())
    ) INTO _has_daily_post;
  EXCEPTION WHEN undefined_table THEN
    _has_daily_post := false;
  END;

  -- Active today: closed lead in last 24h
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

  _active_today := _working_now OR _has_daily_post OR _closed_lead_24h;

  RETURN jsonb_build_object(
    'working_now', COALESCE(_working_now, false),
    'active_today', COALESCE(_active_today, false),
    'has_daily_post', COALESCE(_has_daily_post, false),
    'closed_lead_24h', COALESCE(_closed_lead_24h, false),
    'last_signal_at', _last_signal_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_activity_signals(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) get_my_referrals_full()
--    Complete referrals history + per-status ranking, for the dedicated
--    /dashboard/indicacoes page.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_referrals_full()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _user_ref text;
  _totals jsonb;
  _items jsonb;
  _points_log jsonb;
  _rank int;
  _rank_total int;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('available', false);
  END IF;

  SELECT user_ref INTO _user_ref FROM public.profiles WHERE user_id = _uid LIMIT 1;

  -- Totals by status
  SELECT jsonb_build_object(
    'total',     COUNT(*)::int,
    'pending',   COUNT(*) FILTER (WHERE status = 'pending')::int,
    'qualified', COUNT(*) FILTER (WHERE status = 'qualified')::int,
    'rewarded',  COUNT(*) FILTER (WHERE status IN ('rewarded','completed'))::int,
    'revoked',   COUNT(*) FILTER (WHERE status = 'revoked')::int,
    'points_earned', COALESCE(SUM(reward_points) FILTER (WHERE status IN ('rewarded','completed')), 0)::int
  ) INTO _totals
  FROM public.referrals
  WHERE referrer_id = _uid;

  -- Full items list (joined with referred profile)
  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO _items
  FROM (
    SELECT r.id,
           r.status,
           r.reward_points,
           r.created_at,
           r.qualified_at,
           r.rewarded_at,
           COALESCE(p.display_name, p.full_name, 'Profissional indicado') AS referred_name,
           p.city AS referred_city,
           p.state AS referred_state,
           p.account_type AS referred_account_type
      FROM public.referrals r
      LEFT JOIN public.profiles p ON p.user_id = r.referred_id
     WHERE r.referrer_id = _uid
     ORDER BY r.created_at DESC
     LIMIT 200
  ) x;

  -- Points credited history specifically from referrals
  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(y) ORDER BY (row_to_json(y))->>'created_at' DESC), '[]'::jsonb) INTO _points_log
    FROM (
      SELECT id, points, action_key, created_at, metadata
        FROM public.engagement_log
       WHERE user_id = _uid
         AND action_key = 'referral_first_post'
       ORDER BY created_at DESC
       LIMIT 100
    ) y;
  EXCEPTION WHEN undefined_table THEN
    _points_log := '[]'::jsonb;
  END;

  -- Ranking among referrers (by qualified count)
  WITH agg AS (
    SELECT referrer_id,
           COUNT(*) FILTER (WHERE status IN ('rewarded','completed')) AS rewarded_cnt
      FROM public.referrals
     GROUP BY referrer_id
  ), ranked AS (
    SELECT referrer_id,
           rewarded_cnt,
           DENSE_RANK() OVER (ORDER BY rewarded_cnt DESC) AS rk,
           COUNT(*) OVER () AS total_referrers
      FROM agg
     WHERE rewarded_cnt > 0
  )
  SELECT rk::int, total_referrers::int
    INTO _rank, _rank_total
    FROM ranked
   WHERE referrer_id = _uid
   LIMIT 1;

  RETURN jsonb_build_object(
    'available', true,
    'user_ref', _user_ref,
    'totals', COALESCE(_totals, jsonb_build_object('total',0,'pending',0,'qualified',0,'rewarded',0,'revoked',0,'points_earned',0)),
    'items', _items,
    'points_log', _points_log,
    'rank', _rank,
    'rank_total', _rank_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_referrals_full() TO authenticated;