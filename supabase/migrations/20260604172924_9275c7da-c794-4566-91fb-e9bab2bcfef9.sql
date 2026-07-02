-- Defensive: ensure admin DELETE policy exists on public.subscriptions.
-- UPDATE policy already exists; this closes the DELETE gap for admin tooling
-- without granting anyone else delete access. Idempotent.
DROP POLICY IF EXISTS "Admins can delete subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can delete subscriptions"
  ON public.subscriptions
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Defensive: ensure no legacy overbroad UPDATE policy remains on sponsor_leads.
-- The "Public can attach docs to recent lead" policy was dropped in
-- 20260523071651; this re-asserts it idempotently so a re-apply of older
-- migrations cannot resurrect it. Restricted anon path remains
-- ("Anon attach unclaimed lead docs") + admin UPDATE.
DROP POLICY IF EXISTS "Public can attach docs to recent lead" ON public.sponsor_leads;