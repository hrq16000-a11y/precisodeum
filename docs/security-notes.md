# Notas de Segurança — Ações Manuais Recomendadas

Este documento registra tarefas de segurança que **não podem ser executadas pelo agente Lovable** e precisam de ação humana.

## 1. Rotacionar chaves publicáveis expostas em `.env` / `.env_old`

Se esses arquivos foram commitados no histórico Git alguma vez, mesmo contendo apenas chaves anônimas/publicáveis:

- Rotacione **VITE_SUPABASE_PUBLISHABLE_KEY** em `Project Settings > API` (Supabase Dashboard).
- Rode `git filter-repo --path .env --path .env_old --invert-paths` localmente e force-push
  (só o mantenedor humano do repo deve fazer isso — Lovable não gerencia git state).
- Adicione `.env*` ao `.gitignore` (já presente).

## 2. Reindexar sitemap após deploy

Após aplicar migrations que corrigem grants/canonicals:

1. Acesse Google Search Console → Sitemaps.
2. Reenvie `https://www.precisodeum.com.br/sitemap.xml`.
3. Solicite indexação manual das URLs críticas de `/profissional/:slug` e `/empresa/:slug`
   que voltaram a resolver.

## 3. Migração de extensões PostgreSQL para schema `extensions`

Extensões atualmente instaladas no schema `public` (ex: `pg_trgm`, `unaccent`, `pg_cron`).
Migrar para `extensions` reduz superfície de ataque, mas:

- Requer janela de manutenção (algumas RPCs precisam ter `search_path` reajustado).
- Risco médio-alto de quebrar triggers com `SET search_path = public`.
- **Recomendação:** planejar em release dedicada, testar em staging antes.

## 4. Rate limiting em Edge Functions públicas

O backend não possui primitiva de rate-limiting padrão. Findings de scanners
sobre este tema podem ser ignorados até que a infraestrutura seja implementada.

## 5. Headers de segurança em produção

O arquivo `public/_headers` inclui CSP/HSTS/etc., mas **Lovable Hosting não processa
`_headers`**. Os headers só têm efeito se o projeto for hospedado em Netlify/Vercel/Cloudflare.
Documentado como best-effort futuro.
