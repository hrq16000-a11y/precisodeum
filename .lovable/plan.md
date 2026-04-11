

## Plano: Otimizacoes de Performance — Fase 3

### Problemas identificados

1. **NotificationCenter no critical path via Header** — O Header importa `NotificationBell` de `NotificationCenter.tsx`, que por sua vez puxa `framer-motion`, `date-fns/formatDistanceToNow`, `date-fns/locale/ptBR` e `useNotifications` (com query ao Supabase). Tudo isso entra no bundle principal porque o Header e eager.

2. **Index.tsx eagerly loaded** — A pagina Index e importada de forma sincrona no App.tsx (linha 33). Ela traz consigo o Header, HeroBanner, SearchBar, GeoLocationChip, RotatingServiceText e todos os hooks associados. Embora seja a rota principal, a conversao para lazy com `prefetch` imediato manteria o mesmo UX mas permitiria code-splitting.

3. **MutationObserver no main.tsx observa TODA mutacao do DOM** — O `bodyObs.observe(document.documentElement, { childList: true, subtree: true })` dispara `observeLazyImages()` em cada mutacao DOM (centenas por segundo durante hydration). Deveria ser throttled.

4. **`cleanupFrequencyData()` sincrono no boot** — Executa logica de localStorage sincronamente antes do `createRoot`. Deveria ser deferido.

5. **Toaster + Sonner eagerly loaded** — Ambos sao importados de forma sincrona no App.tsx mas so sao necessarios quando um toast e disparado.

---

### Alteracoes

**1. `src/components/Header.tsx`** — Lazy load do NotificationCenter

- Substituir `import { NotificationBell } from '@/components/NotificationCenter'` por um lazy import com Suspense
- Isso remove `framer-motion`, `date-fns` e `useNotifications` do bundle critico
- **Impacto: ~80-120KB fora do critical path**

**2. `src/main.tsx`** — Throttle do MutationObserver + defer cleanup

- Envolver `observeLazyImages()` num `requestAnimationFrame` debounce para que nao execute centenas de vezes durante hydration
- Mover `cleanupFrequencyData()` para dentro de `requestIdleCallback`

**3. `src/App.tsx`** — Lazy load Index com prefetch imediato

- Converter `import Index from "./pages/Index"` para lazy
- Adicionar prefetch imediato (delay 0) para que o chunk comece a carregar instantaneamente
- O `PageFallback` (CinematicLoader) ja existe e cobre o intervalo
- **Impacto: permite que o shell (React, Router, QueryClient) renderize antes da pagina completa**

**4. `src/App.tsx`** — Lazy load Toaster e Sonner

- Converter ambos para lazy imports com `Suspense fallback={null}`
- Sao componentes de notificacao que so precisam estar montados quando um toast dispara (React Query ja faz buffering)

---

### Resumo de impacto

```text
Mudanca                                    Economia estimada
────────────────────────────────────────────────────────────
NotificationCenter lazy no Header          ~80-120KB critical JS
Index lazy + prefetch imediato             code-split principal (~150KB)
Throttle MutationObserver                  -50+ callbacks/hydration
Defer cleanupFrequencyData                 -2ms boot bloqueio
Lazy Toaster + Sonner                      ~15KB critical JS
────────────────────────────────────────────────────────────
```

### Arquivos modificados
- `src/components/Header.tsx`
- `src/main.tsx`
- `src/App.tsx`

