
CREATE OR REPLACE FUNCTION public.get_latest_user_access_logs()
RETURNS TABLE(
  user_id uuid,
  ip_address text,
  isp text,
  city text,
  region text,
  country text,
  browser text,
  os text,
  device_type text,
  event_type text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (l.user_id)
    l.user_id, l.ip_address, l.isp, l.city, l.region, l.country,
    l.browser, l.os, l.device_type, l.event_type, l.created_at
  FROM public.user_access_logs l
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY l.user_id, l.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_latest_user_access_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_user_access_logs() TO authenticated;
