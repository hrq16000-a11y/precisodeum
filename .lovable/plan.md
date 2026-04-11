

# Plano de Otimizacao de Performance — Por Etapas

## Diagnostico Atual

O projeto ja possui uma base solida de otimizacao: code-splitting com lazy loading, content-visibility, consolidated queries, image transforms, prefetch, e cache agressivo via PWA. As melhorias abaixo focam no que ainda pode ser ganho.

---

## Etapa 1 — Reducao do Bundle Critico (FCP/LCP)

**Problema**: `Header.tsx` importa 9 icones do lucide-react de forma estatica, e `HeroBanner.tsx` carrega componentes que poderiam ser deferidos.

**Acoes**:
- Trocar imports estaticos de icones Lucide no Header por imports nomeados mais seletivos ou lazy-load dos icones menos criticos (ex: `Thermometer`, `ChevronRight`)
- No `HeroBanner`, deferrar os `FloatingDots` decorativos para apos o LCP (ja usa requestAnimationFrame, mas pode usar `requestIdleCallback`)
- Remover o `PageTransition` wrapper da pagina Index (e critico, nao precisa de animacao de entrada)

---

## Etapa 2 — Otimizar Waterfall de Dados na Home

**Problema**: A home faz 2 queries sequenciais — categories+providers primeiro, depois `home-secondary-data` so quando `primaryReady=true`. Isso cria um waterfall de ~300-500ms.

**Acoes**:
- Disparar `home-secondary-data` em paralelo (remover `enabled: primaryReady`) ja que nao depende dos dados primarios
- Adicionar `staleTime: Infinity` e `gcTime` maior para `site-settings` (atualmente 5min, pode ser 15-30min ja que muda raramente)
- Pre-popular o cache do React Query com dados do localStorage para renderizacao instantanea no retorno

---

## Etapa 3 — Preload de Imagens Criticas (LCP)

**Problema**: As imagens do hero banner (`/hero-bg-*.jpg`) nao tem `<link rel="preload">` e dependem do JS para carregar.

**Acoes**:
- Adicionar `<link rel="preload" as="image" fetchpriority="high">` no `index.html` para a primeira imagem do hero
- Converter imagens hero para WebP e adicionar `fetchpriority="high"` no `<img>` do HeroBanner
- Na logo do Header, adicionar `fetchpriority="high"` e remover `loading="lazy"`

---

## Etapa 4 — Reducao de Re-renders

**Problema**: `useSiteSettings()` e chamado por multiplos hooks (`useFeatureEnabled` x7, `useSettingValue` x3 na home) — cada um cria uma subscription separada ao mesmo queryKey.

**Acoes**:
- Criar um unico hook `useHomeFeatureFlags()` que retorna todos os flags de uma vez, evitando 10+ re-renders individuais
- Memoizar o `renderSection` com `useCallback` (ja e funcao inline que recria a cada render)
- Envolver sections distantes da dobra em `memo()` para evitar re-render cascata

---

## Etapa 5 — Service Worker e PWA

**Problema**: O SW custom (`src/sw.ts`) conflita com o SW gerado pelo vite-plugin-pwa (ambos registram rotas para API, fonts e imagens com estrategias diferentes).

**Acoes**:
- Remover `src/sw.ts` custom e consolidar toda a logica no `workbox` config do `vite.config.ts` (evita dois SWs competindo)
- Ou: configurar o vite-plugin-pwa para usar `injectManifest` apontando para `src/sw.ts` (unificando)
- Reduzir `globPatterns` para excluir imagens pesadas do precache (cacheadas on-demand ja)

---

## Etapa 6 — Fonts e CSS

**Problema**: Google Fonts carrega 3 pesos de 2 familias (Plus Jakarta Sans + Inter) — ~120KB de fontes.

**Acoes**:
- Reduzir para apenas os pesos realmente usados no caminho critico (Inter 400,500 + Jakarta 700)
- Adicionar `font-display: swap` explicito (ja vem do Google Fonts, mas confirmar)
- Mover o critical CSS inline do `index.html` para incluir cores de fundo e tamanhos do header (evita flash)

---

## Etapa 7 — Geo/Weather Optimization

**Problema**: A geolocalizacao faz ate 3 requests em cascata (edge function -> ipapi -> ipwho) + 1 para temperatura. Isso consome banda e atrasa o badge.

**Acoes**:
- Aumentar o TTL do cache geo de 30min para 2-4 horas (a cidade do usuario raramente muda)
- Consolidar geo + weather em uma unica edge function que retorna tudo (ja existe `geo-city-weather`, mas os fallbacks IP fazem requests extras)
- Cancelar requests de fallback se o edge function ja retornou dados validos

---

## Etapa 8 — Build e Chunks

**Problema**: `manualChunks` ja separa vendor, mas componentes admin/dashboard/sponsor sao carregados no mesmo grafo.

**Acoes**:
- Verificar que nenhum import estatico puxa codigo admin para o bundle principal
- Adicionar chunk separado para `recharts` (ja existe `vendor-charts`, confirmar isolamento)
- Considerar `rollupOptions.treeshake.moduleSideEffects: false` para eliminacao mais agressiva

---

## Resumo de Impacto Esperado

| Etapa | Metrica | Ganho estimado |
|-------|---------|----------------|
| 1 | FCP | -100-200ms |
| 2 | TTI | -300-500ms |
| 3 | LCP | -200-400ms |
| 4 | INP | -50-100ms |
| 5 | Cache hits | +30% |
| 6 | Font load | -40KB |
| 7 | Network | -2-3 requests |
| 8 | Bundle | -50-100KB |

Posso implementar todas as etapas sequencialmente ou voce prefere focar em alguma especifica?

