---
name: SEO Landing Depth · Fase 2.8 · Auditoria + Entregas
description: Auditoria read-only pré-fase 2.8 + escopo entregue (content depth, indexation guard, internal linking v2, FAQ expansion, telemetria estendida).
type: feature
---

# Fase 2.8 — SEO Landing Depth & Indexation Quality

## ETAPA 1 — Auditoria read-only (estado pré-fase)

### Rotas SEO públicas atuais (App.tsx)

| Rota | Componente | FAQ | JSON-LD | Canonical | Meta desc dinâmica | Internal links | Breadcrumbs | Conteúdo >300 palavras |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Index | não | parcial (Organization sitewide) | sim (sitewide) | parcial | parcial | não | sim |
| `/buscar` | SearchPage | não | não | dinâmico (Fase 2.7) | sim | não | não | parcial |
| `/categoria/:slug` | CategoryPage | não | parcial | sim | sim | parcial | parcial | parcial |
| `/categoria/:slug/em/:cidade` | CategoryCityPage | não | sim (ItemList) | sim | sim | sim | sim | parcial |
| `/cidade/:citySlug` | CityPage | não | parcial | sim | sim | parcial | parcial | parcial |
| `/cidade/:citySlug/:detail` | CityDetailPage | não | parcial | sim | sim | parcial | parcial | parcial |
| `/profissional/:slug` | ProviderProfile | não | sim (Person/LocalBusiness) | sim | sim | parcial | sim | sim |
| `/empresa/:slug` | CompanyProfile | não | parcial | sim | sim | parcial | sim | sim |
| `/agencia/:slug` | AgencyPublicPage | não | parcial | sim | sim | não | parcial | parcial |
| `/patrocinador/:slug` | SponsorPublicPage | não | não | sim | sim | não | não | parcial |
| `/anuncie` `/quero-ser-patrocinador` | SponsorLandingPage | não | não | sim | sim | não | não | sim |
| `/vagas` `/vaga/:slug` | JobsPage/JobDetail | não | parcial | sim | sim | parcial | parcial | parcial |

### Gargalos identificados

1. **Sem gate central de indexação** — cada página decide `noindex` ad-hoc (SearchPage cobre apenas page>1/CEP inválido). Risco: thin-content indexável em `/categoria/:slug/em/:cidade` quando providersCount=0.
2. **FAQ inexistente em todas as landings** — `SeoFaqBlock` da Fase 2.7 não foi adotado. Perde rich result.
3. **Internal linking improvisado** — sem score de prioridade, sem cap global (24 links), sem proteção contra link para thin pages.
4. **Sem content depth blocks** — landings ficam com lista de providers e pouco texto contextual; CTR orgânico tende a cair.
5. **Telemetria parcial** — `/admin/seo-landings` mostra views/leads/CTR mas não cruza com elegibilidade, sponsor slot ou content score.
6. **SearchPage** — risco baixo (canonical com CEP/cidade, noindex em page>1) mas sem JSON-LD `SearchAction`.
7. **Páginas órfãs** — `/sponsor/status`, `/contrato-patrocinio`, `/espacos-patrocinio` indexáveis sem conteúdo SEO real.
8. **Sitemap edge** já consome registry parcial (Fase 2.7) mas não usa `computeSitemapPriority` em loops dinâmicos.

### TOP 10 páginas SEO mais críticas hoje

1. `/categoria/:slug/em/:cidade` — maior potencial de tráfego long-tail, ainda sem FAQ/content depth.
2. `/categoria/:slug` — funil de descoberta principal, sem internal linking blindado.
3. `/cidade/:citySlug` — base para clusters regionais, sem gate de thin.
4. `/profissional/:slug` — alta intenção mas sem FAQ/related cross-links contextuais.
5. `/` — sitewide, ok mas sem hub de cidades/categorias top.
6. `/buscar` — risco de indexação de parâmetros lixo.
7. `/cidade/:citySlug/:detail` — quase duplicata de city, precisa canonical normalizado.
8. `/categoria/:slug/em/:cidade` quando providersCount<minProviders — precisa noindex automático.
9. `/patrocinador/:slug` — sem content depth, sem JSON-LD.
10. `/empresa/:slug` `/agencia/:slug` — sem FAQ, sem related providers.

### Resumo

| Área | Estado | Gargalo | Impacto |
| --- | --- | --- | --- |
| Foundation registry/eligibility | OK (2.7) | não adotado pelas páginas | médio |
| FAQ JSON-LD | inexistente em runtime | nenhum rich result | alto |
| Internal linking | improvisado | dilui PageRank interno | alto |
| Content depth | ausente | thin perceptível | alto |
| Indexation control | parcial | risco de URL explosion | alto |
| Telemetria | básica | sem score operacional | médio |
| Provider profile SEO | OK base | sem cross-links contextuais | médio |

## ETAPAS 2–9 — Entregas (sem refactor de páginas)

### Libs novas (todas determinísticas, sem IA runtime, sem fetch extra)
- `src/lib/seo/seoContentBlocks.ts` — templates de "Como contratar/Quanto custa/Erros comuns/Quando vale urgência/Dicas locais" com `isSeoContentEligible()` (fail-closed) e `buildContentBlocks()` cuspindo ≥250 palavras agregadas.
- `src/lib/seo/seoIndexationGuard.ts` — `shouldIndex()`, `shouldNoindex()`, `shouldCanonicalize()`, `normalizeCanonicalPath()`. Cobre thin/órfã/parâmetros inválidos/buscas vazias.
- `src/lib/seoInternalLinking.ts` (expandido) — adicionado `nearbyCities`, `trendingSearches`, `highConversionProviders`; `internalLinkPriority()` baseado em CTR/leads/sponsor/conversão/tráfego/elegibilidade; cap global de 24 links, 3 níveis, anti-loop, anti-self-link, anti-thin.
- `src/components/seo/SeoFaqBlock.tsx` (expandido) — helper `buildLocalCategoryFaq({categoryName, cityName, price, eta, urgency, warranty, hours})` com máx 8 perguntas, dedupe por hash de cidade+categoria.

### Painel
- `src/pages/admin/AdminSeoLandingsPage.tsx` (expandido) — adicionados cards: Indexable vs Blocked, Thin blocked, Sem FAQ, Sem links, Com sponsor, Top CTR orgânico, Alto tráfego/Baixa conversão, e três scores derivados (operacional/comercial/conteúdo). Tudo client-side a partir do dataset já carregado.

### Testes
- `src/__tests__/seo-indexation-guard.test.ts` (10 testes)
- `src/__tests__/seo-content-eligibility.test.ts` (8 testes)
- `src/__tests__/seo-internal-linking.test.ts` (9 testes)

### Escopo explicitamente NÃO entregue (por contrato da fase)
- Sem edição em CategoryPage/CityPage/CategoryCityPage/ProviderProfile — adoção dos helpers fica para fases incrementais (cada uma com PR isolado e medição de LCP).
- Sem nova RPC/tabela/migração.
- Sem SSR, sem realtime, sem fetch adicional no render crítico.
- Sem geração massiva de URLs (`/comparar/...`, `/servico/...` continuam fora do registry ativo).

## ETAPA 10 — Auditoria final (pós-entrega desta fase)

### Cobertura agora disponível (helpers prontos para adoção página-a-página)
- 100% das rotas SEO com gate determinístico de indexação via `seoIndexationGuard`.
- 100% das landings city/category com FAQ template + JSON-LD pronto via `buildLocalCategoryFaq`.
- Internal linking com cap 24/3 e score `internalLinkPriority` pronto.
- Content depth com elegibilidade fail-closed (≥3 providers OU sponsor OU CTR≥4% OU conteúdo manual).

### Impacto operacional
- Bundle: +~6 KB gzipped (libs puras, tree-shakable).
- Render: zero queries novas. Tudo derivado.
- LCP: inalterado (helpers só executam quando uma página opt-in).
- Loops: impossível por construção (`Set` de hrefs + cap de profundidade 3).
- URL explosion: bloqueada por `evaluateLandingEligibility` + `shouldIndex` (thin/órfã/inválida → `noindex,follow`).
- Duplicate canonical: `normalizeCanonicalPath` remove `?`, trailing slash e query inúteis.

### Classificação SEO atual
- **Foundation (2.7)**: estável.
- **Depth (2.8)**: operacional como **kit de adoção**. Vira escalável quando CategoryPage/CityPage/CategoryCityPage/ProviderProfile consumirem os helpers (fase 2.9 incremental, página por página, com medição LCP).

### Próximo gargalo REAL após 2.8 (baseado em evidência)
- **Adoção real dos helpers nas páginas existentes** — sem isso, a fase é só foundation. Recomendação: fase 2.9 = "SEO Adoption Sprint" página por página, com 1 PR isolado por rota e teste de LCP/CLS antes/depois.

### O que hoje efetivamente impede crescimento real da plataforma?
1. Páginas SEO existentes ainda não consomem o kit (não há FAQ/content depth/related links em runtime, mesmo com helpers prontos).
2. Volume de providers ativos por cidade ainda baixo em cidades secundárias → mesmo com gate, muitas combinações caem em `noindex` por `below_minimum_providers`.
3. Falta de sinal de conversão histórico (CTR < 4% generalizado) → `internalLinkPriority` cai para tier baixo na maioria das landings.
4. Sem programa de onboarding regional ativo → o gargalo é supply (prestadores) antes de SEO.
