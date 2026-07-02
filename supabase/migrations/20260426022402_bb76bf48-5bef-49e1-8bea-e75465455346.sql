CREATE OR REPLACE FUNCTION public.admin_onboarding_funnel(
  _days int DEFAULT 30,
  _variant text DEFAULT NULL
)
RETURNS TABLE (
  phase text,
  event text,
  total bigint,
  unique_sessions bigint,
  unique_users bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.phase,
    e.event,
    COUNT(*)::bigint AS total,
    COUNT(DISTINCT e.session_id)::bigint AS unique_sessions,
    COUNT(DISTINCT e.user_id)::bigint AS unique_users
  FROM public.onboarding_events e
  WHERE e.created_at >= now() - (GREATEST(_days, 1) || ' days')::interval
    AND (_variant IS NULL OR e.variant = _variant)
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  GROUP BY e.phase, e.event
  ORDER BY e.phase, e.event;
$$;

REVOKE ALL ON FUNCTION public.admin_onboarding_funnel(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_funnel(int, text) TO authenticated;