
-- Remove the dangerous direct INSERT policy on engagement_log
-- Points must only be awarded through the security definer function award_engagement_points()
DROP POLICY IF EXISTS "Users can insert own engagement logs" ON public.engagement_log;

-- Add a restrictive INSERT policy that only allows the system (security definer functions) to insert
-- Since award_engagement_points is SECURITY DEFINER, it bypasses RLS, so we can safely block direct inserts
CREATE POLICY "No direct insert to engagement_log"
ON public.engagement_log
FOR INSERT
TO authenticated
WITH CHECK (false);
