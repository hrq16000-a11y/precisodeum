# PORTABILIDADE.md — Migração definitiva

Este documento descreve, do zero ao app rodando em outro host, como restaurar
o projeto **Preciso de Um** a partir do "Golden Zip" gerado em
`/admin/portabilidade`.

---

## 1. Arquitetura mínima esperada no novo host

- Postgres 15+ com extensões: `pgcrypto`, `pg_trgm`, `unaccent`, `pg_cron`,
  `pg_net`, `postgis`.
- Supabase (self-hosted ou Cloud) — para Auth, Storage, Edge Functions.
- Node 20 (frontend Vite) e Deno (Edge Functions).
- Buckets de Storage: `avatars`, `portfolio`, `service-images`, `media`,
  `sponsor_assets`, `portability` (privado, admin only).

---

## 2. Estrutura recomendada do ZIP final

```
golden-zip/
├── manifest.json           # gerado pela edge portability-bundle
├── RESTORE.md              # passo a passo curto incluído no ZIP
├── PORTABILIDADE.md        # este arquivo
├── .env.example            # nomes de todas as variáveis
├── code/                   # snapshot do repositório (sincronize via GitHub)
├── db/
│   ├── 01-schema.sql       # pg_dump --schema-only (gerado por você)
│   ├── 02-data.sql         # pg_dump --data-only --column-inserts
│   ├── 03-grants.sql       # opcional: privilégios e papéis
│   └── per-table/          # dumps individuais (opcional, ver §4)
├── storage/
│   ├── avatars/...
│   ├── portfolio/...
│   ├── service-images/...
│   └── manifest-storage.json   # checksums SHA-256 por arquivo
├── cron/
│   └── recreate-cron-jobs.sql
└── scripts/
    └── download-storage.mjs    # backup manual via Service Role
```

---

## 3. Comandos `pg_dump` prontos

> Substitua `$DB` pela connection string real, ex.:
> `postgresql://postgres:<senha>@db.<ref>.supabase.co:5432/postgres`

### 3.1 Dump completo (recomendado para 99% dos casos)

```bash
pg_dump "$DB" \
  --no-owner --no-privileges \
  --schema=public \
  --exclude-schema=auth --exclude-schema=storage --exclude-schema=realtime \
  --exclude-schema=supabase_functions --exclude-schema=vault \
  -f db/dump-full.sql
```

### 3.2 Schema separado de dados (para revisão antes do restore)

```bash
# 1) Apenas estrutura
pg_dump "$DB" --schema-only --no-owner --no-privileges \
  --schema=public -f db/01-schema.sql

# 2) Apenas dados (column-inserts é mais portátil entre versões)
pg_dump "$DB" --data-only --column-inserts --no-owner --no-privileges \
  --schema=public -f db/02-data.sql
```

### 3.3 Dumps por tabela (para reimportação seletiva)

A ordem abaixo respeita as dependências lógicas (todas as tabelas críticas
incluem `user_ref text` para portabilidade):

```bash
mkdir -p db/per-table

# Núcleo de identidade
pg_dump "$DB" --data-only --column-inserts -t public.profiles      -f db/per-table/10-profiles.sql
pg_dump "$DB" --data-only --column-inserts -t public.user_roles    -f db/per-table/11-user_roles.sql
pg_dump "$DB" --data-only --column-inserts -t public.providers     -f db/per-table/12-providers.sql

# Taxonomia
pg_dump "$DB" --data-only --column-inserts -t public.service_categories -f db/per-table/20-service_categories.sql

# Conteúdo do prestador
pg_dump "$DB" --data-only --column-inserts -t public.services      -f db/per-table/30-services.sql
pg_dump "$DB" --data-only --column-inserts -t public.portfolio     -f db/per-table/31-portfolio.sql
pg_dump "$DB" --data-only --column-inserts -t public.portfolio_albums -f db/per-table/32-portfolio_albums.sql
pg_dump "$DB" --data-only --column-inserts -t public.provider_page_settings -f db/per-table/33-provider_page_settings.sql

# Operação
pg_dump "$DB" --data-only --column-inserts -t public.leads         -f db/per-table/40-leads.sql
pg_dump "$DB" --data-only --column-inserts -t public.lead_history  -f db/per-table/41-lead_history.sql
pg_dump "$DB" --data-only --column-inserts -t public.lead_interactions -f db/per-table/42-lead_interactions.sql
pg_dump "$DB" --data-only --column-inserts -t public.notifications -f db/per-table/43-notifications.sql

# Patrocinadores
pg_dump "$DB" --data-only --column-inserts -t public.sponsors      -f db/per-table/50-sponsors.sql
pg_dump "$DB" --data-only --column-inserts -t public.sponsor_leads -f db/per-table/51-sponsor_leads.sql

# Configurações globais (sempre por último — referenciam IDs gerados acima)
pg_dump "$DB" --data-only --column-inserts -t public.site_settings -f db/per-table/90-site_settings.sql
pg_dump "$DB" --data-only --column-inserts -t public.tier_rules    -f db/per-table/91-tier_rules.sql
```

### 3.4 Backfill explícito de `user_ref`

Se você precisar repopular `user_ref` (chave logical de migração):

```sql
-- profiles, providers, services, leads, sponsors etc.
-- Cada tabela já tem trigger sincronizando user_ref na inserção, mas para
-- registros antigos rode:

UPDATE public.profiles      SET user_ref = COALESCE(user_ref, id::text)            WHERE user_ref IS NULL;
UPDATE public.providers     SET user_ref = COALESCE(user_ref, user_id::text)       WHERE user_ref IS NULL;
UPDATE public.services      SET user_ref = COALESCE(user_ref, provider_id::text)   WHERE user_ref IS NULL;
UPDATE public.leads         SET user_ref = COALESCE(user_ref, provider_id::text)   WHERE user_ref IS NULL;

-- Sponsors usam fallback "sponsor_legacy:<slug>" quando não há user_id.
UPDATE public.sponsors
   SET user_ref = COALESCE(user_ref,
        CASE WHEN user_id IS NOT NULL THEN user_id::text
             ELSE 'sponsor_legacy:' || slug END)
 WHERE user_ref IS NULL;
```

Validação imediata após o backfill:

```sql
SELECT * FROM public.audit_user_ref_health() ORDER BY missing DESC;
```

---

## 4. Restore ordenado (com dependências)

> **Regra de ouro:** restaure SCHEMA primeiro, DEPOIS dados, e SÓ ENTÃO
> recrie cron jobs e webhooks.

```bash
# 1) Habilite extensões no novo banco
psql "$NEW_DB" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql "$NEW_DB" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
psql "$NEW_DB" -c "CREATE EXTENSION IF NOT EXISTS unaccent;"
psql "$NEW_DB" -c "CREATE EXTENSION IF NOT EXISTS pg_cron;"
psql "$NEW_DB" -c "CREATE EXTENSION IF NOT EXISTS pg_net;"
psql "$NEW_DB" -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# 2) Schema (estrutura, RLS, funções, triggers)
psql "$NEW_DB" -v ON_ERROR_STOP=1 -f db/01-schema.sql

# 3) Desabilite triggers durante o load para acelerar
psql "$NEW_DB" -c "SET session_replication_role = replica;"

# 4) Dados na ordem das dependências (use os arquivos per-table OU 02-data.sql)
for f in db/per-table/*.sql; do
  echo ">> $f"
  psql "$NEW_DB" -v ON_ERROR_STOP=1 -f "$f"
done

# 5) Reabilite triggers e rode o backfill de user_ref
psql "$NEW_DB" -c "SET session_replication_role = DEFAULT;"
psql "$NEW_DB" -f db/backfill-user-ref.sql

# 6) Recrie cron jobs
psql "$NEW_DB" -f cron/recreate-cron-jobs.sql

# 7) Suba os arquivos do Storage (Service Role)
node scripts/download-storage.mjs --upload ./storage

# 8) Valide no painel: /admin/portabilidade → "Restaurar em novo host"
```

---

## 5. Edge Functions (deploy)

```bash
# CLI Supabase
supabase login
supabase link --project-ref $NEW_REF
supabase functions deploy --no-verify-jwt

# Configure os secrets esperados:
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set VAPID_PRIVATE_KEY=...
```

A tela `/admin/portabilidade → Secrets` lista o status (configurado/pendente)
de cada chave consultando a edge function `portability-restore?action=secrets-checklist`.

---

## 6. Validação automática pós-restore

Após o restore, abra `/admin/portabilidade → Restaurar em novo host` e rode:

1. **Schema integrity** — confere existência das tabelas críticas e cobertura
   global de `user_ref` (mínimo aceitável: 95%).
2. **Storage checksums** — recalcula SHA-256 dos arquivos restaurados e
   compara com `manifest-storage.json` do bundle original.
3. **Smoke tests** — testa RPCs (`has_role`, `audit_user_ref_health`),
   leitura das tabelas críticas e listagem dos buckets.

O snapshot só é marcado como **"pronto"** se as três etapas passarem.

---

## 7. Cron jobs (recriação)

Os 9 jobs ativos estão em `cron/recreate-cron-jobs.sql`. Atualize a URL e o
ANON_KEY antes de aplicar:

| Job                          | Frequência | Função                             |
|------------------------------|------------|-------------------------------------|
| process-lead-followups       | hourly     | lembretes 12/24/48/72h              |
| expire-sponsors              | daily 03h  | expira anúncios fora do prazo       |
| notify-lead-performance      | every 6h   | leads de alto engajamento           |
| sync-service-areas-cron      | daily 04h  | recalcula áreas de atendimento      |
| import-rss / import-jobs-rss | every 6h   | notícias e vagas externas           |
| cleanup-orphan-media         | weekly     | mídia sem vínculo                   |
| storage-backup               | weekly     | backup completo do Storage          |
| portability-bundle (manual)  | sob demanda| ZIP de migração                     |

---

## 8. Smoke tests recomendados (manual)

- [ ] Login com Google
- [ ] Cadastro novo de prestador (`/cadastro-bet`)
- [ ] Busca pública por categoria + cidade (proximidade)
- [ ] Geração de lead (`Quero contato`) → notificação chega
- [ ] Upload de foto no portfólio
- [ ] Painel admin (`/admin`) responde com role correto
