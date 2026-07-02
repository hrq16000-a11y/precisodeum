CREATE POLICY "Users can create own subscription"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM providers p
    WHERE p.id = provider_id
      AND p.user_id = auth.uid()
  )
);