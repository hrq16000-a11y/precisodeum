---
name: Guide Mode Preview & JSON-LD Audit
description: Preview /preview/guia, auditoria JSON-LD × brand config, sitemap/robots do modo guia e dry-run CSV/JSON de indexação
type: feature
---

- `src/lib/seo/jsonLdBrandAudit.ts` (puro): `auditJsonLd` / `auditRoutesJsonLd` validam @context, @type, campos obrigatórios por tipo, URLs absolutas, domínio da marca e nome do brand config.
- `src/lib/seo/guideSitemap.ts`: `GUIDE_FEATURE_PREFIXES`, `classifyGuidePath`, `buildGuideSitemap` (exclui noindex + features desligadas), `guideCanonical`, `buildGuideRobotsTxt` (bloqueia recursos off + `/preview/`).
- Rota `/preview/guia` (`src/pages/GuidePreviewPage.tsx`): override de guide mode escopado ao mount, noindex, mostra catálogo/conteúdo/slots/lead demo. `/preview` está em PUBLIC_PATH_PREFIXES e `Disallow: /preview/` em public/robots.txt.
- Dry-run: `npm run seo:dryrun -- --categories=a,b --cities=x,y --providers=5 --out=.lovable/seo-dryrun` gera `.json` + `.csv` com index/noindex, wordCount, faqCount e reasons. Não escreve no banco.
- Testes: `src/test/guide-mode-seo-suite.test.tsx` (12) — JSON-LD por rota, sitemap/robots guia, slots por página/cidade e guarda de layout mobile.
