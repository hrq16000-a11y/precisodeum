---
name: Conversion Optimization Foundation (Fase 2.6)
description: Camada de conversão — stats agregados, bucketização, boost leve na busca, variantes de CTA e painel admin.
type: feature
---

# Fase 2.6 — Conversion Optimization Foundation

## Auditoria do ranking atual (READ-ONLY)

- **SearchPage**: ordenação primária acontece na RPC `nearby_providers` (Online Boost v3 + level_priority + visibility_score + engagement_points + rating). Espelho client-side em `src/lib/rankingTieBreak.ts`. Pesos do score híbrido em `site_settings.search_score_weights`.
- **PinnedSponsor**: card fixado no topo via `usePinnedSponsor` (categoria/cidade/UF) — não compete com o grid.
- **Sponsor inline**: `SponsorAdSlot` lazy.
- **Sem ML, sem feed algorítmico, sem black-box.**

## Sinais disponíveis (já coletados)

| Sinal | Origem |
|---|---|
| `profile_view` | `audit_log` (resource_type='public_funnel', action='profile_view') |
| `lead_submit` | `audit_log` (action='lead_submit') |
| `whatsapp_click` / `phone_click` | `contact_clicks` |
| `sponsor_click` / `sponsor_ref` | `audit_log.details->>sponsor_ref` (Fase 2.3) |

## Entregas

### 1. Score determinístico (`src/lib/conversionSignals.ts`)
- Pesos visíveis: `lead_rate:100`, `ctr:40`, `whatsapp_share:15`, `sponsor_bonus:5`, `premium_bonus:3`.
- Bucketize: `high_conversion / medium_conversion / low_conversion / unknown`.
- `MIN_VIEWS_FOR_BUCKET = 10` evita ruído estatístico.
- `applyDiversityCap` impede streak de mesmo provider (cap=2).

### 2. Stats agregados (SQL)
- `get_provider_conversion_stats(_provider_ids uuid[], _days int)` — leitura pública.
- `admin_provider_conversion_insights(_days, _limit)` — admin only.
- Índices: `idx_audit_log_funnel_resource` (parcial), `idx_leads_provider_created`.

### 3. Hook `useProviderConversionScores`
- Lote por lista de providerIds, cache 5 min.

### 4. Reorder leve na busca
- Só ativa quando `site_settings.conversion_boost_enabled=true` **e** `sortBy in {relevance, best}`.
- Não sobrescreve escolha explícita (`rating`, `nearest`, etc.).
- Multiplier suave (`0.95..1.15`) sobre score base = posição reversa. Empata por idx original.
- `applyDiversityCap(2)` sempre aplicado (cheap, melhora exposição).

### 5. CTA Variants (sem framework A/B)
- `site_settings.cta_whatsapp_variant` / `cta_lead_variant`.
- `src/lib/ctaVariants.ts` — registry + helpers.
- Variante propagada via `ctaSourceTag('whatsapp', variant)` no `page_path` do `contact_clicks` (sem novo RPC).
- Comparação CTR por variante: agregação posterior via `contact_clicks.page_path LIKE '%cta:whatsapp:%'`.

### 6. Admin Insights
- `/admin/provider-conversion` — 3 cards (Top / Baixa / Vistos sem clique) + tabela ranking.

### 7. Anti-gaming (já existente)
- Dedup `record_public_funnel_event` (10 min server-side + sessionStorage).
- Bot filter por User-Agent no RPC.
- `visitor_id` por sessão em `contact_clicks`.

### 8. Performance
- Zero polling, zero realtime, zero recompute em render.
- Cache 5 min (React Query) + lazy import do admin page.
- Reorder roda só nos primeiros 80 cards visíveis.

## Sponsor priority boost
- Aplicado via `CONVERSION_WEIGHTS.sponsor_bonus = 5` quando há `hasActiveSponsor`.
- Não toma over: bucket multiplier máximo é `1.15`. Diversidade obrigatória.

## Reversibilidade
- Flag `conversion_boost_enabled` em `site_settings` (default `false`). Sem flag → comportamento idêntico ao anterior (apenas o diversity cap fica ativo).
- Variantes de CTA voltam ao default removendo a chave de `site_settings`.

## Próxima fase recomendada
- **2.7 — SEO Landing Expansion Runtime**: clusters regionais, geração assistida, landing orchestration agora que o funil converte melhor.
