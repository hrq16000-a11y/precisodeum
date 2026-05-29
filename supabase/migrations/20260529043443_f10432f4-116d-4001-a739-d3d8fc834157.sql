-- Restaurar GRANTs perdidos da tabela public.providers
-- Sem isso, RLS nunca é avaliado: PostgREST retorna 42501 "permission denied for table providers"
-- antes mesmo de checar as policies. Isso quebra useAuth, busca pública e perfis.
GRANT SELECT ON public.providers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.providers TO authenticated;
GRANT ALL ON public.providers TO service_role;