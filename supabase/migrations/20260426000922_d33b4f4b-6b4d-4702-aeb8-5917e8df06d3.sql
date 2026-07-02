-- Aperta política de INSERT em open_leads para impedir spoofing de client_user_id.
-- Antes: WITH CHECK (true) permitia anônimo informar QUALQUER client_user_id.
-- Agora: anônimos só podem inserir com client_user_id NULL; autenticados só
-- podem inserir lead em seu próprio nome (client_user_id = auth.uid()) OU NULL
-- (lead anônimo).
DROP POLICY IF EXISTS "Anyone can create open leads" ON public.open_leads;

CREATE POLICY "Anyone can create open leads"
ON public.open_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  client_user_id IS NULL
  OR client_user_id = auth.uid()
);