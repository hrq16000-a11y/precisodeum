DROP POLICY IF EXISTS "Sponsor can view own campaigns" ON public.sponsor_campaigns;
CREATE POLICY "Sponsor can view own campaigns with active plan"
ON public.sponsor_campaigns
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.current_user_owns_sponsor(sponsor_id)
    AND public.sponsor_has_active_plan(sponsor_id)
  )
);