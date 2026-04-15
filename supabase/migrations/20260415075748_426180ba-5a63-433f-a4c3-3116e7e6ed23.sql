
-- Tighten the INSERT policy: only allow self-inserts (triggers use SECURITY DEFINER so they bypass RLS)
DROP POLICY IF EXISTS "System can insert engagement logs" ON public.engagement_log;
CREATE POLICY "Users can insert own engagement logs"
  ON public.engagement_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
