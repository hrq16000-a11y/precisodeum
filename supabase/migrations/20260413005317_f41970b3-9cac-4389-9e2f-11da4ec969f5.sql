
-- Remove duplicate INSERT policy on governance_changes_log
DROP POLICY IF EXISTS "Admins can insert governance changes" ON public.governance_changes_log;
-- Keep only "Only admins can insert governance changes"

-- sponsor_metrics: the track_sponsor_metric function uses SECURITY DEFINER
-- so no additional INSERT policy is needed for end users.
-- No changes needed here.
