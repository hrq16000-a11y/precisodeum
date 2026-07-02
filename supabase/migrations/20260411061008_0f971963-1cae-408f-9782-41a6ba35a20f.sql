CREATE POLICY "Provider can delete own leads"
ON public.leads
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM providers
    WHERE providers.id = leads.provider_id
    AND providers.user_id = auth.uid()
  )
);