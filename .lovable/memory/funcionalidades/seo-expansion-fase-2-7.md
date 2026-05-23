---
name: SEO Landing Expansion · Fase 2.7
description: Foundation registry + eligibility + internal linking + admin telemetria para escala regional de landings sem thin content.
type: feature
---

# Fase 2.7 — SEO Landing Expansion Foundation

## Objetivo
Transformar a plataforma em máquina regional de aquisição **sem** gerar páginas lixo, doorway pages, SSR massivo ou CMS complexo. Tudo incremental, indexável, auditável e reversível.

## Auditoria (estado pré-fase)
- **Rotas SEO ativas**: `/categoria/:slug` (CategoryPage), `/categoria/:slug/em/:citySlug` (CategoryCityPage), `/cidade/:citySlug` (CityPage), `/cidade/:citySlug/:detail` (CityDetailPage).
- **Páginas auxiliares**: SponsorLandingPage, SeoPage, StateProviderPage.
- **Helpers existentes**: `useSeoHead`, `categorySeo.ts`, `seoAuthority.ts`, `seoUrlFallback.ts`, `sitemapBuilder.ts`, `slugify.ts`.
- **Edge functions**: `sitemap`, `seo-audit`, `og-profile`.
- **Telemetria**: `audit_log` com `resource_type='public_funnel'` (whitelist `category_view`/`city_view`/`profile_view`/`lead_submit`).
- **Gaps identificados**:
  - SEO espalhado em vários componentes sem registry central.
  - Nenhum gate determinístico de thin-content (cada página decide ad-hoc).
  - Internal linking improvisado caso a caso.
  - Sem painel admin agregando performance por landing.

## Entregas desta fase

### Foundation libs
- `src/lib/seoRouteRegistry.ts` — registry central com tipos (`home`, `city`, `category`, `category_city`, `service`, `urgency`, `neighborhood`, `comparison`). Inclui `basePriority`, `changefreq`, `requiresProviders`, `minProviders`, `hasSponsorSlot`. Helper `computeSitemapPriority` aplica boosts (`sponsored`, `healthy`) e penalidade quando providers < mínimo.
- `src/lib/seoLandingEligibility.ts` — `evaluateLandingEligibility()` retorna `{ indexable, status, reasons, robots }`. Status: `healthy | thin | sponsored | high_conversion` (CTR ≥ 4%). `isValidSeoSlug` reaproveita regex `^[a-z0-9][a-z0-9-]{1,79}$`.
- `src/lib/seoInternalLinking.ts` — `buildRelatedLinks()` gera no máximo 3 blocos × 8 links, dedupa, exclui path atual, descarta slugs inválidos.

### Componentes SEO
- `src/components/seo/SeoRelatedLinks.tsx` — renderiza blocos do helper acima (semântico `<nav aria-label>`).
- `src/components/seo/SeoFaqBlock.tsx` — FAQ com JSON-LD `FAQPage` (mínimo 2 perguntas, máximo 10).

### Admin
- `src/pages/admin/AdminSeoLandingsPage.tsx` — telemetria 30d agregando `audit_log` por path: Top landings, Thin pages (<5 views), Sem cliques (≥5 views e 0 leads), Alta conversão (CTR ≥ 4%). Filtro por path. `noindex` no próprio painel.

### Testes
- `src/__tests__/seo-landing-foundation.test.ts` — 11 testes cobrindo registry, prioridades, eligibility (thin/healthy/high_conversion/invalid_slug) e internal linking (limites, exclusão de path atual, descarte de slugs inválidos).

## Escopo proibido (respeitado)
- Sem IA gerando texto massivo, sem doorway pages, sem auto-spin, sem SSR total, sem CMS, sem embeddings, sem vector SEO.
- Sem alteração nas páginas existentes (CategoryPage/CityPage/CategoryCityPage permanecem intactas) — adoção dos helpers fica para fases incrementais subsequentes.
- Sem migração de banco nesta etapa (telemetria já vive em `audit_log`).

## Riscos / débitos aceitos
- CategoryPage/CityPage ainda não consomem o registry — adoção deve ser incremental por página, validada por testes de SEO existentes.
- Sitemap edge ainda não consome `computeSitemapPriority`; fase futura pode plugá-lo.
- Painel admin lê últimos 5 000 eventos (limite de query Supabase). Para volumes maiores, criar RPC dedicada.
