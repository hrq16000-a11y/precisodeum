-- 1. Reviews: only show approved reviews publicly
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
DROP POLICY IF EXISTS "Users can view own reviews" ON public.reviews;

CREATE POLICY "Approved reviews viewable by everyone" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (approval_status = 'approved');

CREATE POLICY "Users can view own reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2. runtime_component_health: admin only
DROP POLICY IF EXISTS "Authenticated users can insert component health" ON public.runtime_component_health;
DROP POLICY IF EXISTS "Authenticated users can report component errors" ON public.runtime_component_health;
DROP POLICY IF EXISTS "Component health viewable by authenticated" ON public.runtime_component_health;
DROP POLICY IF EXISTS "Admins manage component health" ON public.runtime_component_health;

CREATE POLICY "Admins manage component health" ON public.runtime_component_health
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. governance_changes_log: admin only
DROP POLICY IF EXISTS "Users can insert own governance changes" ON public.governance_changes_log;
DROP POLICY IF EXISTS "Governance log viewable by authenticated" ON public.governance_changes_log;
DROP POLICY IF EXISTS "Admins can insert governance changes" ON public.governance_changes_log;
DROP POLICY IF EXISTS "Admins can view governance changes" ON public.governance_changes_log;

CREATE POLICY "Admins can insert governance changes" ON public.governance_changes_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view governance changes" ON public.governance_changes_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));