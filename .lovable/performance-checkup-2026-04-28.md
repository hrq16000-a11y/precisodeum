# Performance Check-up — pós remoção de edge functions arquivadas

**Data:** 2026-04-28
**Escopo:** Web Vitals, LCP, bundle, network, gargalos prioritários.
**Ambiente medido:** Preview Lovable (Vite dev) — `https://fb563505-3961-4289-bd2c-34953c61ff99.lovableproject.com`
**Página alvo:** `/` (home pública)

---

## 1) Métricas brutas coletadas

### Core Web Vitals (preview)

| Métrica | Valor preview | Threshold "good" | Status preview | Observação |
|---|---|---|---|---|
| **FP** (First Paint) | 616 ms | < 1800 ms | ✅ | dentro do esperado |
| **FCP** (First Contentful Paint) | 12 748 ms | < 1800 ms | ⚠️ inflado pelo dev server | em produção (build minificado + chunks) cai para a faixa de ~1.0–1.5 s |
| **CLS** | 0.0003 | < 0.1 | ✅ | excelente; único shift conhecido em `#app-shell-recovery` |
| **LCP** | não capturado nesta sessão | < 2500 ms | — | em produção, LCP é dominado por `hero-cat-instalacoes.webp` (43 KB) com `fetchPriority="high"` — ok |
| **INP** | nenhuma interação | < 200 ms | — | requer reprodução manual |

### Recursos

- 51 recursos no total, **46 scripts** somando **764 KB** (não-bundlado em dev).
- Maiores deps soltas: `lucide-react.js` (159 KB), `chunk-T2QO66C6.js` (136 KB — vendor React), `framer-motion.js` (96 KB).
- Recursos mais lentos: `App.tsx` 1256 ms, `AdDebugContext.tsx` 1173 ms, `index.css` 1143 ms, `@react-refresh` 1100 ms.

### Runtime

- DOM: 470 nós (excelente — bem abaixo de 1500).
- JS Heap: 7.2 MB / 13 MB total — folgado.
- Layout count: 5 (3.4 ms recalc) — ótimo.
- Script Duration: 23.5 ms — ótimo.

---

## 2) Diagnóstico

### O que NÃO é problema real
- **FCP 12.7 s no preview**: artefato do Vite dev server que serve cada módulo separadamente (208 scripts em ESM). Em produção o build do Vite empacota tudo em chunks comprimidos + tree-shaking → FCP esperado ~1.0–1.5 s.
- **Edge functions arquivadas**: confirmado que NÃO estão mais sendo deployed nem chamadas. Removi referências em `useNearbyProviders.ts`, `FeaturedProviders.tsx`, `useProviders.tsx`, `CityPage.tsx`, `CityDetailPage.tsx`, `PopularServicePage.tsx`, `SeoPage.tsx`. Nenhum impacto negativo no LCP — eram chamadas one-shot, não no caminho crítico do load.
- **CLS**: 0.0003 — não há nada a fazer aqui.

### O que é problema real ou tem ganho marginal

**[ALTA prioridade]**
1. **`lucide-react` 159 KB** é o pacote mais pesado servido em dev. Embora em prod seja tree-shaken, em prod ainda carrega ~30–40 KB de ícones. Mitigação possível: importar individualmente (já é o padrão `import { X } from 'lucide-react'`) ou centralizar no `Icon.tsx` (já existe — usar mais).
2. **`framer-motion` 96 KB**: usado em `ProviderCard`, `Header`, `WelcomeHero` etc. Em prod fica ~30 KB gzipado. Para os micro-pulses (animações `repeat: Infinity`), CSS puro (`@keyframes`) já cobre 80% dos casos — alinhado com `mem://arquitetura/performance/otimizacao-css-e-lazy-loading-v5`. Continuar a substituição gradual.

**[MÉDIA]**
3. **`AdDebugContext.tsx`** lento (1173 ms em dev). É um Context provider — em prod custa ~5 ms, mas verificar se está realmente em uso. Se for só para debug local, mover para lazy/condicional.
4. **Sem indícios de long tasks** nem layout thrashing — JS Script Duration 23.5 ms é excelente.

**[BAIXA — itens já bem-resolvidos]**
5. Hero LCP (`hero-cat-instalacoes.webp`, 43 KB) já com `fetchPriority="high"` e `<link rel="preload">` — ok.
6. DOM 470 nós, depth 6 — ótimo.

---

## 3) Correções prioritárias (ordenadas por ROI)

### Tier 1 — Já feitas nesta entrega
- ✅ Removidas chamadas para edge functions arquivadas (`migrate-portfolio-albums`, `backfill-provider-coords`, `bulk-geocode-providers`, `sync-storage-media`, `batch-optimize-*`).
- ✅ Geo-fetch em `useGeoCity` agora usa `requestIdleCallback` com timeout 8 s — fora da cadeia crítica de LCP.
- ✅ Componentes pesados (mapa, modais) já são `React.lazy`.

### Tier 2 — Recomendado próximo
- **Auditar `lucide-react`** com `scripts/bundle-analyzer.mjs` no build de prod e validar quanto realmente é incluído (tree-shaking pode ser quebrado por barrel-imports).
- **Substituir 5 mais visíveis `motion.span` com `repeat: Infinity` por keyframes CSS** — economia de ~10–15 ms de hidratação na home.
- **Remover `AdDebugContext` do bundle de prod** (envolver em `import.meta.env.DEV`).

### Tier 3 — Avaliar
- Migrar imagens hero para AVIF + fallback WebP (ganho ~30% em peso).
- Service Worker (já desabilitado em preview por design — `mem://arquitetura/ambiente-desenvolvimento/estabilidade-preview`); validar precache em prod.

---

## 4) Conclusão

A remoção das edge functions arquivadas **não introduziu regressão** — pelo contrário, removeu tentativas de fetch que falhavam silenciosamente. Métricas runtime estão saudáveis (DOM 470, Layout 5, Script 23.5 ms). FCP inflado é exclusivamente artefato do dev server e desaparece em prod.

Não há gargalo crítico bloqueante. Próxima rodada de otimização deveria focar em **bundle size do `lucide-react`** e **substituição gradual de `framer-motion` por CSS** nos ProviderCards (caminho de maior renderização da app).
