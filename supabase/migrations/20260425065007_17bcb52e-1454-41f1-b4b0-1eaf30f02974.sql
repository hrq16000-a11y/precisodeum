CREATE OR REPLACE FUNCTION public.get_my_referral_points_timeline(_period_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  start_date timestamptz;
  daily jsonb;
  top_referrals jsonb;
  total_points int;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('available', false);
  END IF;

  start_date := now() - (GREATEST(_period_days, 1) || ' days')::interval;

  WITH days AS (
    SELECT generate_series(date_trunc('day', start_date), date_trunc('day', now()), interval '1 day')::date AS d
  ),
  pts AS (
    SELECT date_trunc('day', created_at)::date AS d,
           COALESCE(SUM(points_awarded),0)::int AS pts
    FROM public.engagement_log
    WHERE user_id = uid
      AND action_key IN ('referral_qualified','referral_rewarded','referral_first_post')
      AND created_at >= start_date
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object('date', days.d, 'points', COALESCE(pts.pts,0)) ORDER BY days.d)
    INTO daily
    FROM days
    LEFT JOIN pts ON pts.d = days.d;

  SELECT COALESCE(SUM(points_awarded),0)::int
    INTO total_points
    FROM public.engagement_log
   WHERE user_id = uid
     AND action_key IN ('referral_qualified','referral_rewarded','referral_first_post')
     AND created_at >= start_date;

  WITH top AS (
    SELECT r.id,
           r.points_awarded,
           COALESCE(r.rewarded_at, r.qualified_at, r.created_at) AS event_at,
           p.full_name AS referred_name,
           p.user_ref AS referred_user_ref
    FROM public.referrals r
    LEFT JOIN public.profiles p ON p.id = r.referred_id
    WHERE r.referrer_id = uid
      AND COALESCE(r.rewarded_at, r.qualified_at) >= start_date
      AND r.points_awarded > 0
    ORDER BY r.points_awarded DESC, COALESCE(r.rewarded_at, r.qualified_at) DESC
    LIMIT 5
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'points', points_awarded,
    'event_at', event_at,
    'referred_name', referred_name,
    'referred_user_ref', referred_user_ref
  )) INTO top_referrals FROM top;

  RETURN jsonb_build_object(
    'available', true,
    'period_days', _period_days,
    'total_points', total_points,
    'daily', COALESCE(daily, '[]'::jsonb),
    'top_referrals', COALESCE(top_referrals, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_referral_points_timeline(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_active_today_providers()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT user_id FROM public.daily_posts
   WHERE created_at >= now() - interval '24 hours'
  UNION
  SELECT DISTINCT pr.user_id
    FROM public.leads l
    JOIN public.providers pr ON pr.id = l.provider_id
   WHERE l.status IN ('completed','won','closed','converted')
     AND l.created_at >= now() - interval '24 hours'
$$;

GRANT EXECUTE ON FUNCTION public.get_active_today_providers() TO anon, authenticated;