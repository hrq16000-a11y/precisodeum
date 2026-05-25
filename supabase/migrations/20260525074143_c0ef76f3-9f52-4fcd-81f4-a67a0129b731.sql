-- Passo 4: blindagem de account_deletion_requests
-- Opção A — fechar porta direta; Edge Function (SERVICE_ROLE) continua sendo a única porta pública

DROP POLICY IF EXISTS "anyone can request deletion" ON public.account_deletion_requests;

CREATE POLICY "Deny direct inserts on account_deletion_requests"
ON public.account_deletion_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

REVOKE INSERT ON public.account_deletion_requests FROM anon, authenticated;