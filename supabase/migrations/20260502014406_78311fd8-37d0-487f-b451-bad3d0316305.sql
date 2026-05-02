CREATE OR REPLACE FUNCTION public.admin_review_anchor_audit(_days integer DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - make_interval(days => greatest(coalesce(_days, 14), 1));
  v_total bigint := 0;
  v_unique_users bigint := 0;
  v_by_ghost jsonb := '[]'::jsonb;
  v_by_anchor jsonb := '[]'::jsonb;
  v_recent jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*), count(DISTINCT user_id)
    INTO v_total, v_unique_users
    FROM public.onboarding_events
   WHERE event = 'review_anchor_used'
     AND created_at >= v_since;

  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.occurrences DESC), '[]'::jsonb)
    INTO v_by_ghost
  FROM (
    SELECT
      coalesce(meta->>'ghost_phase', 'unknown') AS ghost_phase,
      count(*)::bigint                          AS occurrences,
      count(DISTINCT user_id)::bigint           AS unique_users
    FROM public.onboarding_events
    WHERE event = 'review_anchor_used'
      AND created_at >= v_since
    GROUP BY 1
    ORDER BY occurrences DESC
    LIMIT 50
  ) x;

  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.occurrences DESC), '[]'::jsonb)
    INTO v_by_anchor
  FROM (
    SELECT
      coalesce(meta->>'anchor_phase', phase::text, 'unknown') AS anchor_phase,
      count(*)::bigint                                        AS occurrences
    FROM public.onboarding_events
    WHERE event = 'review_anchor_used'
      AND created_at >= v_since
    GROUP BY 1
    ORDER BY occurrences DESC
    LIMIT 50
  ) x;

  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC), '[]'::jsonb)
    INTO v_recent
  FROM (
    SELECT
      created_at,
      user_id,
      meta->>'ghost_phase' AS ghost_phase,
      meta->>'anchor_phase' AS anchor_phase,
      meta->>'flow' AS flow
    FROM public.onboarding_events
    WHERE event = 'review_anchor_used'
      AND created_at >= v_since
    ORDER BY created_at DESC
    LIMIT 50
  ) x;

  RETURN jsonb_build_object(
    'since', v_since,
    'days', _days,
    'total', v_total,
    'unique_users', v_unique_users,
    'by_ghost_phase', v_by_ghost,
    'by_anchor_phase', v_by_anchor,
    'recent', v_recent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_anchor_audit(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_anchor_audit(integer) TO authenticated;