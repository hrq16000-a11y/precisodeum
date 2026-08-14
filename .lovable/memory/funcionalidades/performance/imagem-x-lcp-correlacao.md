---
name: Correlação Imagem × LCP
description: Sinais IMG_ERROR/IMG_DEGRADED em web_vitals_log cruzados com LCP por rota no /admin (Core Web Vitals)
type: feature
---

- Coletor `src/lib/webVitals/imageHealth.ts`: audita `picture img, img[data-loaded], img[data-img-scope]` (AVIF, WebP, srcSet, sizes, blur-up) + captura erros de `<img>/<source>` em fase de captura. Máx. 60 imagens por flush.
- `webVitalsPerRoute` envia `IMG_ERROR` e `IMG_DEGRADED` junto com LCP/CLS/INP no mesmo flush (mesma `created_at` = mesma pageview). RPC `log_web_vitals` teve whitelist estendida para essas 2 métricas e limite de 10→12 amostras.
- Engine pura `src/lib/webVitals/imageCorrelation.ts`: `correlateImagesWithLcp` (delta de LCP p75 entre visitas com/sem problema, veredito ok/suspeita/provavel_causa quando Δ ≥ 300ms), `imageLcpDaily`, `pearsonImageLcp`, `topImageIssues`. Mínimo 3 visitas por rota (anti falso positivo).
- UI: `src/components/admin/ImageLcpCorrelationCard.tsx` renderizado em `/admin` → Core Web Vitals (`AdminWebVitalsPage`).
- Testes: `src/__tests__/image-lcp-correlation.test.ts` (13).
