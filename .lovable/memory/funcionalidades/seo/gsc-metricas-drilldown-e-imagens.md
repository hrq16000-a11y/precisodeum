---
name: Métricas GSC, drill-down AdSense e imagens responsivas
description: Painel /admin/seo/metricas (7d), drill-down por rota do AdSense, export JSON/CSV, alertas persistentes e variantes AVIF/WebP do hero + srcSet da galeria
type: feature
---

- `src/lib/seo/gscMetrics.ts` calcula submissões, latência (de `gsc_audit_log.response->>duration_ms`), taxa de falha e percentuais por sitemap/partição nos últimos 7 dias. UI em `src/pages/admin/AdminSeoMetricsPage.tsx` (tab "Métricas GSC (7d)").
- `src/lib/seo/adsenseHistory.ts` guarda histórico local das verificações; `routeFailureStreak` alimenta badge "Nx seguidas" e o dialog de drill-down por rota em `AdminGscSubmissionsPage` (quando/HTTP/código/mensagem/link de diagnóstico).
- `src/lib/seo/persistentAlerts.ts` define regras configuráveis (N falhas consecutivas + severidade) salvas em `site_settings`; `src/lib/seo/auditExport.ts` gera relatório consolidado JSON/CSV.
- Imagens: `scripts/generate-hero-variants.mjs` (sharp) gera `/hero-cat-<slug>-{640,1280,1920}.{avif,webp}`; HeroBanner usa `<picture>` AVIF→WebP→JPG com `heroSrcSet()` e `sizes="100vw"`; preload no index.html aponta para a variante AVIF. Galeria do perfil usa `responsiveImageSrcSet(originalUrl(url), [300,600,900])` + `loading="lazy"` + `.motion-img`.
