# QA Seed · 100k providers

> ⚠️ **Apenas QA.** Estes scripts criam dados fictícios em massa e **nunca devem
> rodar em produção**. Todos os registros são marcáveis e removíveis pelo prefixo
> `seed:loadtest100k:` em `user_ref`, e pelo domínio `@qa.precisodeum.local` no
> `email`.

## Ordem de execução

```bash
export QA_DATABASE_URL="postgresql://postgres:<senha>@db.<qa-ref>.supabase.co:5432/postgres"

# 1) Validação/backfill defensivo da taxonomia
psql "$QA_DATABASE_URL" -f scripts/qa-seed/00-categories-validate.sql

# 2) Seed 100k providers + EXPLAIN ANALYZE pós-carga
psql "$QA_DATABASE_URL" -f scripts/qa-seed/10-providers-100k.sql
```

## Idempotência

O passo 0 do `10-providers-100k.sql` apaga **apenas** registros marcados com:

- `profiles.user_ref  LIKE 'seed:loadtest100k:%'`
- `profiles.email     LIKE 'seed-loadtest-%@qa.precisodeum.local'`
- `providers.user_ref LIKE 'seed:loadtest100k:%'`
- `auth.users.email   LIKE 'seed-loadtest-%@qa.precisodeum.local'`

Pode rodar N vezes — sempre regenera do zero sem tocar dados reais.

## Limpeza manual (sem recriar)

```sql
SET session_replication_role = replica;
DELETE FROM public.providers WHERE user_ref LIKE 'seed:loadtest100k:%';
DELETE FROM public.profiles  WHERE user_ref LIKE 'seed:loadtest100k:%';
DELETE FROM auth.users       WHERE email    LIKE 'seed-loadtest-%@qa.precisodeum.local';
SET session_replication_role = DEFAULT;
```

## Distribuição geográfica

| Cidade            | Volume  |
|-------------------|---------|
| São Paulo/SP      | 22.000  |
| Curitiba/PR       | 18.000  |
| Rio de Janeiro/RJ | 15.000  |
| 24 outras capitais| ~1.875 cada (~45.000) |
| **Total**         | **100.000** |

Jitter de ±0.45° (~50 km) determinístico via `md5(user_ref)` para simular região
metropolitana sem perder reprodutibilidade.

## Garantias para o índice parcial `idx_providers_geog_active`

Todos os registros saem com:

- `status = 'approved'`
- `onboarding_progress->>'completed' = 'true'` (e `profiles.onboarding_completed = true`)
- `deleted_at IS NULL`
- `geog` populado via `ST_MakePoint(longitude, latitude)::geography`

A seção 5 do script roda `EXPLAIN (ANALYZE, BUFFERS)` em 4 capitais
(Curitiba/SP/RJ/Manaus) com raios variados (5/10/15/25 km) e checa
`pg_stat_user_indexes` para confirmar que `idx_providers_geog_active` está sendo
usado pelo RPC.

## Campos extras populados (para variar testes de ordenação)

- `last_active_at` (recency_factor): rotativo nos últimos 60 dias
- `completion_boost_until` (completion_factor): 30% em +3d, 20% em +1d, 50% null
- `rating_avg` (3.5–5.0) e `review_count` (0–199)
- `years_experience` (1–25)
- `neighborhood` rotativo entre 10 bairros realistas
- `phone` no formato BR `(NN) 9NNNN-NNNN`
- `description` longa com cidade/UF e anos de experiência (varia ranking de FTS)
