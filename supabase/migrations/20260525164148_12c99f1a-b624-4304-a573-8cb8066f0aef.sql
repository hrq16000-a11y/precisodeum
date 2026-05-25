-- Hardening LGPD · S2: bloquear anon de ler cnpj/legal_name/email/whatsapp em agencies.
-- Mantém public read-path apenas para colunas seguras de agências aprovadas.
-- authenticated permanece com SELECT completo (RLS row-level já restringe a aprovadas + dono + admin).

-- 1) Remove SELECT amplo de anon
REVOKE SELECT ON public.agencies FROM anon;

-- 2) Re-concede SELECT apenas em colunas públicas
GRANT SELECT (
  id, user_id, slug, name, description,
  city, state, website,
  logo_url, cover_image_url,
  status, created_at, updated_at, user_ref
) ON public.agencies TO anon;

-- Sanity: as colunas sensíveis (cnpj, legal_name, email, whatsapp) NÃO recebem GRANT,
-- portanto anon recebe permission denied ao tentar lê-las (mesmo via SELECT *).

COMMENT ON TABLE public.agencies IS
  'LGPD hardening 2026-05-25: anon possui SELECT apenas em colunas públicas (sem cnpj/legal_name/email/whatsapp). authenticated mantém SELECT completo + RLS row-level.';