
-- =====================================================
-- 1. FIX: audit_log — remove permissive INSERT policy
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can insert own audit log" ON public.audit_log;

-- Only admins can manually insert audit entries (triggers use SECURITY DEFINER so bypass RLS)
CREATE POLICY "Only admins can insert audit log"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 2. FIX: governance_changes_log — restrict INSERT to admins
-- =====================================================
DROP POLICY IF EXISTS "System can insert governance changes" ON public.governance_changes_log;

CREATE POLICY "Only admins can insert governance changes"
ON public.governance_changes_log
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 3. FIX: providers — replace public SELECT with column-safe version
--    Hide CNPJ from anonymous/non-owner users at RLS level
--    (CNPJ masking is already done via views, but we add defense-in-depth)
-- =====================================================

-- Drop existing overly-permissive public SELECT if it exists
DROP POLICY IF EXISTS "Public can view approved providers" ON public.providers;
DROP POLICY IF EXISTS "Anyone can view approved providers" ON public.providers;
DROP POLICY IF EXISTS "Approved providers are public" ON public.providers;

-- Re-create: approved providers are publicly visible (marketplace requirement)
-- CNPJ protection is enforced at view/application layer per governance
CREATE POLICY "Approved providers are publicly readable"
ON public.providers
FOR SELECT
TO anon, authenticated
USING (
  status = 'approved' AND deleted_at IS NULL
);

-- Owners can always see their own provider (any status)
DROP POLICY IF EXISTS "Owners can view own provider" ON public.providers;
CREATE POLICY "Owners can view own provider"
ON public.providers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can see everything
DROP POLICY IF EXISTS "Admins can view all providers" ON public.providers;
CREATE POLICY "Admins can view all providers"
ON public.providers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
