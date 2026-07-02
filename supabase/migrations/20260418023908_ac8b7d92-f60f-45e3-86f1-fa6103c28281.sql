-- RPC: admin_system_health — returns counts + sample lists for the
-- "System Health" panel in /admin/overview.
CREATE OR REPLACE FUNCTION public.admin_system_health(_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_no_gps jsonb;
  v_no_cnpj jsonb;
  v_no_portfolio jsonb;
  v_counts jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT jsonb_build_object(
    'no_gps', (SELECT COUNT(*) FROM providers
               WHERE status='approved' AND deleted_at IS NULL
                 AND (latitude IS NULL OR longitude IS NULL OR (latitude=0 AND longitude=0))),
    'no_cnpj', (SELECT COUNT(*) FROM providers
                WHERE status='approved' AND deleted_at IS NULL
                  AND (cnpj IS NULL OR TRIM(cnpj)='')),
    'no_portfolio', (SELECT COUNT(*) FROM providers
                     WHERE status='approved' AND deleted_at IS NULL
                       AND COALESCE(portfolio_photo_count,0)=0),
    'total', (SELECT COUNT(*) FROM providers WHERE status='approved' AND deleted_at IS NULL)
  ) INTO v_counts;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_no_gps FROM (
    SELECT p.id, p.user_id, p.business_name, p.city, p.state, p.created_at
    FROM providers p
    WHERE p.status='approved' AND p.deleted_at IS NULL
      AND (p.latitude IS NULL OR p.longitude IS NULL OR (p.latitude=0 AND p.longitude=0))
    ORDER BY p.created_at DESC
    LIMIT _limit
  ) x;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_no_cnpj FROM (
    SELECT p.id, p.user_id, p.business_name, p.city, p.state, p.created_at
    FROM providers p
    WHERE p.status='approved' AND p.deleted_at IS NULL
      AND (p.cnpj IS NULL OR TRIM(p.cnpj)='')
    ORDER BY p.created_at DESC
    LIMIT _limit
  ) x;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_no_portfolio FROM (
    SELECT p.id, p.user_id, p.business_name, p.city, p.state, p.created_at
    FROM providers p
    WHERE p.status='approved' AND p.deleted_at IS NULL
      AND COALESCE(p.portfolio_photo_count,0)=0
    ORDER BY p.created_at DESC
    LIMIT _limit
  ) x;

  RETURN jsonb_build_object(
    'counts', v_counts,
    'no_gps', v_no_gps,
    'no_cnpj', v_no_cnpj,
    'no_portfolio', v_no_portfolio
  );
END;
$$;

-- RPC: admin_notify_users — admin sends a notification to a list of user_ids.
CREATE OR REPLACE FUNCTION public.admin_notify_users(
  _user_ids uuid[],
  _title text,
  _message text,
  _link text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  cnt integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF _user_ids IS NULL OR array_length(_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH uid IN ARRAY _user_ids LOOP
    INSERT INTO public.notifications (user_id, title, message, link, type, sent_by)
    VALUES (uid, _title, _message, _link, 'admin', auth.uid());
    cnt := cnt + 1;
  END LOOP;

  RETURN cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_system_health(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_notify_users(uuid[], text, text, text) TO authenticated;