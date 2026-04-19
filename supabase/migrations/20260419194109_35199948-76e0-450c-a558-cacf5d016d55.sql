
ALTER VIEW public.user_master_view SET (security_invoker = true);
ALTER VIEW public.provider_health_view SET (security_invoker = true);

DROP POLICY IF EXISTS "Service role can insert access logs" ON public.user_access_logs;
CREATE POLICY "Service role can insert access logs"
ON public.user_access_logs
FOR INSERT
TO service_role
WITH CHECK (true);
