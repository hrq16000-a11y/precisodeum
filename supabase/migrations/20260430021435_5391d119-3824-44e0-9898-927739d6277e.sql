-- Fix Bug #4: Adicionar WITH CHECK na política de UPDATE de providers
-- para impedir que um usuário sequestre user_id de outro registro.
DROP POLICY IF EXISTS "Users can update own provider" ON public.providers;
CREATE POLICY "Users can update own provider"
ON public.providers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);