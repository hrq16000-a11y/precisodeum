-- Ensure RLS is enabled
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies with these names to keep migration idempotent
DROP POLICY IF EXISTS "service_role full access" ON public.rate_limits;
DROP POLICY IF EXISTS "deny all to authenticated/anon" ON public.rate_limits;

-- Service role: full access (backend / edge functions)
CREATE POLICY "service_role full access"
ON public.rate_limits
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Deny all access to anon and authenticated clients
CREATE POLICY "deny all to authenticated/anon"
ON public.rate_limits
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
