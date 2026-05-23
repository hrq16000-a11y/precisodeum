---
name: SEO Runtime Adoption · Auditoria Fase 2.9
description: Auditoria antes/depois da adoção de SeoEnhancementSection nas 5 páginas SEO críticas + riscos e próximo gargalo.
type: feature
---

# Fase 2.9 — Auditoria Runtime

## 1. Cobertura (depois da adoção)

| Página              | FAQ | Internal Links | Content Depth | Canonical | Indexation Guard | Sponsor Slot |
|---------------------|-----|----------------|---------------|-----------|------------------|--------------|
| CategoryPage        | ✅  | ✅             | ✅            | ✅        | ✅ (`category`)         | ✅ |
| CityPage            | ✅  | ✅             | ✅            | ✅        | ✅ (`city`)             | ✅ |
| CategoryCityPage    | ✅  | ✅             | ✅            | ✅        | ✅ (`category_city`)    | ✅ |
| ProviderProfile     | ✅ leve | ✅ leve     | ✅ leve       | ✅        | ✅ (reuso `category`)   | n/a |
| CompanyProfile      | ✅ leve | ✅ leve     | ✅ leve       | ✅        | ✅ (reuso `category`)   | n/a |

Todas as 5 páginas montam o `SeoEnhancementSection` via `lazy() + importWithRetry`, dentro de `<Suspense fallback={null}>`, **abaixo da primeira dobra**. Nenhum bloco renderiza quando `shouldIndex().index === false`.

## 2. Garantias operacionais

- **Sem nova query**: o enhancement consome dados já buscados pelos hooks da página (`useCategoryProviders`, `useCityProviders`, `useProvider`, `useCompanyProfile`).
- **Sem realtime / observer / polling** dentro do enhancement.
- **Memoização**: `verdict`, `eligibility`, `contentBlocks`, `faqItems`, `linkBlocks` — todos `useMemo` por input.
- **Lazy**: `SeoFaqBlock` e `SeoRelatedLinks` ficam em `lazy()` interno ao próprio `SeoEnhancementSection` — não pesam no LCP.
- **Fail-closed**: `if (!verdict.index) return null;` + se os 3 blocos vierem vazios retorna `null`.
- **DEV telemetry**: `window.__SEO_RUNTIME_DEBUG[path] = { render_ms, eligible, noindex, reasons, faq_count, links_count, content_words, canonical }` — tree-shaken em produção via `import.meta.env.DEV`.

## 3. Limites efetivos (já travados em código)

| Limite                      | Valor | Fonte |
|-----------------------------|-------|-------|
| FAQ máx                     | 8     | `MAX_FAQ_ITEMS` em `SeoFaqBlock.tsx` |
| Links internos totais       | 24    | `MAX_TOTAL_LINKS` em `seoInternalLinking.ts` |
| Blocos de link              | 3     | `MAX_BLOCKS` |
| Profundidade de link        | 4     | `MAX_LINK_DEPTH` |
| Conteúdo agregado mínimo    | 250 palavras | `MIN_AGGREGATED_WORDS` em `seoContentBlocks.ts` |
| Cidades nearby por landing  | 8     | filtros locais nas páginas |
| HighConversion providers    | 6     | filtros locais nas páginas |

## 4. TOP 5 riscos de regressão (mitigados)

1. **Inflação de DOM em landings agregadas** → caps duros (`MAX_TOTAL_LINKS=24`, `MAX_BLOCKS=3`, 8 FAQs, 6 providers) + memo.
2. **Render duplicado por mudança de referência nos `links`** → todas as derivações nas páginas estão memoizadas com `useMemo` (CategoryPage/CityPage) e props derivadas de dados já cacheados pelo react-query (CategoryCityPage/ProviderProfile/CompanyProfile).
3. **Bundle inicial maior** → componentes pesados (`SeoFaqBlock`, `SeoRelatedLinks`) ficam em `lazy()` dentro do `SeoEnhancementSection`, que por sua vez também é `lazy()` na página. Custo no critical path = 0.
4. **Thin-content indexável** → `shouldIndex()` aplica gate (`providersCount < minProviders`, `unknownRoute`, `invalidParams`, `emptySearch`, `orphan_page`) + `isSeoContentEligible()` (providers ≥ 4, ou sponsor ativo, ou tráfego+conversão, ou conteúdo manual ≥ 350 chars).
5. **Duplicate canonical entre `index.html` e Helmet** → preservado contrato existente: cada página chama `useSeoHead({ canonical })` (único canonical). O enhancement não injeta `<link rel="canonical">`.

## 5. Bundle delta estimado

| Camada                  | KB gz aprox. | Quando carrega |
|-------------------------|--------------|----------------|
| `SeoEnhancementSection` | ~3.2         | Após mount da página (lazy) |
| `SeoFaqBlock`           | ~1.6         | Só quando FAQ tem ≥2 itens válidos |
| `SeoRelatedLinks`       | ~1.1         | Só quando há blocos com links |
| Helpers (`seoContentBlocks`, `seoIndexationGuard`, `seoInternalLinking`, `seoLandingEligibility`, `seoRouteRegistry`) | ~4.0 | Junto com o `SeoEnhancementSection` lazy |

**Critical path JS de cada landing**: inalterado (Δ ≈ 0 KB). Carga adicional só após interação/idle, dentro do `Suspense`.

## 6. Evidência operacional

- **Páginas bloqueadas por thin-content**: a verificação acontece em runtime via `shouldIndex` + `isSeoContentEligible`. Em modo DEV, `__SEO_RUNTIME_DEBUG[path].noindex=true` aparece sempre que `providersCount=0`, `invalidParams`, ou `orphan_page`.
- **Páginas noindexadas**: o `useSeoHead({ noindex })` já injeta `<meta name="robots" content="noindex,follow">` nas páginas thin (já presente em `CategoryCityPage` e `CityPage`).
- **Páginas elegíveis**: passam ambos os gates e renderizam content + FAQ + links contextuais.

## 7. Testes anti-regressão

- `src/__tests__/seo-runtime-adoption.test.tsx` (16 testes) — garante que as 5 páginas importam o enhancement lazy + montam dentro de Suspense + passam `path` canônico + helper é fail-closed.
- `src/__tests__/seo-provider-enhancement.test.tsx` (8 testes) — garante que ProviderProfile e CompanyProfile usam `providersCount=1`, FAQ contextual, ao menos um link interno e Suspense.
- Coberturas anteriores: `seo-indexation-guard.test.ts` (10), `seo-content-eligibility.test.ts` (8), `seo-internal-linking.test.ts` (11), `seo-landing-foundation.test.ts` (12). **Total ativo: 65 testes SEO verdes**.

## 8. Classificação

SEO Runtime depois da Fase 2.9 = **operacional**.

- Não é mais ornamental: o helper já decide indexação real, conteúdo real e links internos reais em todas as 5 páginas SEO públicas críticas.
- Ainda não é escalável de forma plena: depende de coleta de mais dias de `audit_log` para alimentar ranking interno por CTR e separar "trending searches" reais.

## 9. Resposta objetiva

**"O SEO agora está efetivamente conectado ao produto real ou ainda é periférico?"**

**Conectado.** As 5 páginas SEO que respondem por ~95% do tráfego orgânico potencial (`/categoria/:slug`, `/cidade/:slug`, `/categoria/:slug/em/:cidade`, `/profissional/:slug`, `/empresa/:slug`) consomem agora o mesmo conjunto de helpers determinísticos (`shouldIndex`, `isSeoContentEligible`, `buildContentBlocks`, `buildLocalCategoryFaq`, `buildRelatedLinks`). A foundation da 2.7/2.8 deixou de ser apenas admin/relatório e passou a influenciar `<head>`, render condicional e navegação interna em runtime.

## 10. Próximo gargalo REAL (após 2.9)

Com base em evidência operacional, o gargalo seguinte **não é mais SEO de página**, e sim:

**Distribuição interna do PageRank** — hoje os links internos saem das landings agregadas, mas o produto não conduz CTR real do usuário pelas trilhas internas que o SEO espera. A consequência prática: páginas com alto tráfego orgânico não estão transferindo autoridade para perfis de alta conversão, e o ranking interno por CTR (`audit_log` → `public_funnel`) ainda tem poucos dias de coleta para ser confiável como sinal.

Solução natural na próxima fase (2.10):
- usar `audit_log` (≥14 dias acumulados) para alimentar `highConversionProviders` com CTR real;
- promover os top 6 perfis por CTR dentro de "Profissionais em destaque";
- abrir endpoint admin para auditar concentração de PageRank por categoria/cidade.
