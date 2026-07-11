---
name: SEO · Neighborhood landing e sitemap
description: Página /cidade/:citySlug/bairro/:neighborhoodSlug + sub-sitemap neighborhoods com gate anti-thin (≥2 providers). Recusa consciente de doorway /profissional/:slug/em/:cidade.
type: feature
---

# SEO Neighborhood Landing

## Entregas
- `src/pages/NeighborhoodPage.tsx` — rota `/cidade/:citySlug/bairro/:neighborhoodSlug`. Filtra providers aprovados por city+neighborhood normalizado, JSON-LD ItemList (só quando indexável), breadcrumbs, cross-links `categoria/em/cidade` derivados dos providers reais do bairro, `SeoEnhancementSection` (FAQ + internal links + content depth) quando `shouldIndex`.
- `src/routes/publicRoutes.tsx` — rota registrada logo após `/cidade/:slug`.
- `supabase/functions/sitemap/index.ts` — novo `type=neighborhoods` adicionado ao índice; emite pares elegíveis com **mínimo 2 providers** (alinhado com `SEO_ROUTE_REGISTRY.neighborhood.minProviders`), ignora `hoodSlug === citySlug`, `changefreq=monthly`, `priority=0.5`.

## Gates anti-thin ativos
- Cidade não reconhecida (fora do IBGE `isKnownCity`) → `noindex`.
- Menos que `NEIGHBORHOOD_MIN=2` providers → `noindex` + CTA amplo, sem JSON-LD.
- Slug inválido / vazio → `noindex` + `EmptyStateFallback`.
- Bairro com nome idêntico à cidade é descartado no sitemap (evita duplicação canônica).

## Recusas conscientes
- **NÃO existe** `/profissional/:slug/em/:cidade`. Foi solicitado, mas viola memória Core (`no doorway pages`) — geraria milhares de URLs quase-duplicadas por prestador × cidade que ele atende, penalidade Google clássica. O canonical do prestador continua sendo `/profissional/:slug`.
- **NÃO** foi implementado gerador automático de texto por página (memória Core `No Paid AI`) — copy é derivada mecânica dos dados reais.

## Débito aberto
- Página de bairro não tem filtro por categoria ainda (`/cidade/:citySlug/bairro/:neighborhoodSlug/categoria/:cat`). Se demanda aparecer, pode ser adicionada com o mesmo gate (≥2 providers no par).
- `prerender.mjs` não emite bairros — depende de sitemap crawl. Prerender fica sob demanda quando houver volume comprovado (`admin/seo-landings`).
