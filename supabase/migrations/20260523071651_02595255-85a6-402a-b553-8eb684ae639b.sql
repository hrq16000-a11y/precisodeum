-- 1) Remove SELECT em colunas sensíveis de providers para roles públicas
REVOKE SELECT (cpf, cnpj) ON public.providers FROM PUBLIC;
REVOKE SELECT (cpf) ON public.providers FROM anon, authenticated;
REVOKE SELECT (cnpj) ON public.providers FROM anon;
-- authenticated mantém SELECT de cnpj pois há fluxo legítimo (negócio PJ exposto após login conforme regra existente);
-- caso queira blindar totalmente, basta também revogar de authenticated.

-- Garante que service_role e postgres continuem com acesso pleno
GRANT SELECT (cpf, cnpj) ON public.providers TO service_role;

-- 2) sponsor_leads: tighten policy de UPDATE anônimo
DROP POLICY IF EXISTS "Public can attach docs to recent lead" ON public.sponsor_leads;

-- Anônimos só podem completar leads ainda não vinculados, dentro de 24h
CREATE POLICY "Anon can attach docs to unclaimed recent lead"
ON public.sponsor_leads
FOR UPDATE
TO anon
USING (user_id IS NULL AND created_at > now() - interval '24 hours')
WITH CHECK (user_id IS NULL AND created_at > now() - interval '24 hours');

-- Autenticado: só pode editar lead que é seu (já existe policy de owner se houver; caso contrário, mantém via claim_sponsor_lead RPC)

-- 3) Storage: remover upload anônimo no bucket sponsor_assets
DROP POLICY IF EXISTS "sponsor_assets insert public" ON storage.objects;

CREATE POLICY "sponsor_assets authenticated owner insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sponsor_assets'
  AND (storage.foldername(name))[1] = 'leads'
  AND EXISTS (
    SELECT 1 FROM public.sponsor_leads sl
    WHERE sl.id::text = (storage.foldername(name))[2]
      AND (
        sl.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);