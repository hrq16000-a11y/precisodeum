---
name: Rich Results, cache incremental e matriz de slots
description: Validador de elegibilidade a rich results, cache ISR do sitemap/páginas SEO, matriz de slots por cidade e relatório agregado por build
type: feature
---

- `src/lib/seo/richResults.ts` (puro): `RICH_RESULT_RULES` (required + recommended + maxItems por @type), `validateRichResultBlock`, `validateRichResultsPage`, `buildRichResultsReport`, `formatRichResultsLog`. Domínio/marca divergente é tratado como erro bloqueante de elegibilidade.
- `src/lib/seo/seoCache.ts`: `seoCacheKey` (inclui canonical + noindex + cidade + variantes ordenadas), `SeoIncrementalCache` (fresh/stale/expired, LRU, invalidate por prefixo), `computeEtag`/`isNotModified`, `buildSeoCacheHeaders` (SWR; noindex ⇒ `private, no-store` + `X-Robots-Tag`).
- `supabase/functions/sitemap/index.ts`: `respond(xml, req)` emite ETag + `s-maxage=3600, stale-while-revalidate=21600` e responde 304 em `If-None-Match`.
- `src/components/seo/GuideSlotMatrix.tsx`: matriz posição × cidade no `/preview/guia`, simulação local (add/remove por célula, badge "simulado", reset) sem persistência.
- `scripts/seo-build-report.mjs` (`npm run seo:report[:strict]`): varre `dist/*.html` e exporta JSON+CSV com indexáveis/noindex, canônico por marca, tamanhos de title/description, tipos JSON-LD e links internos quebrados.
- Testes: `src/test/seo-rich-results-and-cache.test.ts` (12) e `src/test/seo-breakpoints-cls.test.tsx` (varredura de 6 breakpoints + contrato CLS de cards/slots).
