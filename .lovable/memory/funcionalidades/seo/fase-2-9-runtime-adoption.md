---
name: SEO Runtime Adoption (Fase 2.9)
description: Adoção dos helpers SEO 2.8 em CategoryPage/CityPage/ProviderProfile via SeoEnhancementSection + admin LCP/CTR.
type: feature
---

# Fase 2.9 — SEO Runtime Adoption

Conecta a foundation da Fase 2.8 (content blocks, FAQ, internal linking, indexation guard) às páginas reais do produto, sem refactor estrutural.

## Componente único
`src/components/seo/SeoEnhancementSection.tsx` — wrapper memoizado que:
- chama `shouldIndex()` (fail-closed em thin/órfã/empty/invalid).
- monta `buildContentBlocks()` (≥250 palavras só quando elegível).
- monta `buildLocalCategoryFaq()` + `SeoFaqBlock` (lazy, máx 8 perguntas, JSON-LD FAQPage automático).
- monta `buildRelatedLinks()` + `SeoRelatedLinks` (lazy, MAX_TOTAL_LINKS=24 / MAX_BLOCKS=3).
- DEV-only publica em `window.__SEO_RUNTIME_DEBUG[path]` `{ render_ms, eligible, noindex, reasons, faq_count, links_count, content_words, canonical }`.
- Render gateado: se `noindex` ou nenhum bloco com conteúdo → retorna `null`.

## Páginas adotadas
- `CategoryPage.tsx` — montado após `CategorySeoBlock`. Deriva `relatedCities` e `nearbyCities` (com `distanceKm`) dos providers já carregados; `highConversionProviders` dos top 6 filtrados por SEO. Usa `seoEligibleProviders.length` como `providersCount`.
- `CityPage.tsx` — montado após `CitySeoBlock`. `relatedCategories` vem da lista `allCategories` já buscada; `highConversionProviders` dos top 6 da página.
- `ProviderProfile.tsx` — enhancement leve antes do `<Footer />`: FAQ pequeno por categoria/cidade + `relatedProviders` já fetched virando `highConversionProviders`. Sem novas queries.

## Admin
`/admin/seo-runtime` (link em "Comercial & SEO"): tabela LCP p75 + CLS p75 (de `web_vitals_log`, últimos 14d) cruzado com Views/Leads/CTR (`audit_log` `resource_type='public_funnel'`). Permite comparar antes/depois da adoção 2.9.

## Garantias operacionais
- Sem nova query, sem realtime, sem observer, sem polling — apenas pure functions sobre dados já presentes.
- `useMemo` em todos os derivados (content, FAQ, links, verdict).
- `SeoFaqBlock` e `SeoRelatedLinks` em `lazy()` — não impactam LCP.
- DEV telemetry tree-shaken em produção via `import.meta.env.DEV`.
- Fail-closed em todas as decisões: na dúvida → não renderiza.

## Próximo gargalo (após 2.9)
Adoção em `CategoryCityPage` e `CompanyProfile` + ranking interno por CTR real para subir provedores de alta conversão dentro de "Profissionais em destaque" — depende de mais dias de coleta no `audit_log`.
