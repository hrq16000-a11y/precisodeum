

## Plano: Otimizar velocidade de carregamento

### Problemas identificados

1. **`import * as LucideIcons` no MobileBottomNav** — importa TODOS os ~1500 icones do lucide-react no bundle principal. Impacto enorme no JS parse time.

2. **Componentes nao-criticos carregados eagerly no App.tsx** — `CookieConsent`, `PwaInstallBanner`, `FloatingHelpButton`, `BackToTopButton`, `MobileBottomNav`, `ScrollProgressBar`, `ProfileTypeChooser` sao importados de forma sincrona mas nao sao necessarios para o First Contentful Paint.

3. **framer-motion no Header** — o Header esta no critical path e importa `motion` de framer-motion apenas para a animacao da logo. Deveria usar CSS puro.

4. **Query `home-secondary-data` com queries encadeadas** — faz 4 queries paralelas incluindo uma cadeia services → providers → cities que e desnecessariamente complexa para o carregamento inicial.

5. **Preload de `hero-bg-1.jpg` no index.html** — forca download de uma imagem que pode nem ser a selecionada (o HeroBanner usa `pickRandom`).

---

### Alteracoes

**1. `src/components/MobileBottomNav.tsx`** — Eliminar `import * as LucideIcons`
- Remover o wildcard import
- Usar um mapa manual com os icones mais comuns (Home, Search, LayoutGrid, User, Plus, Bell, etc.)
- Fallback para `Home` se o icone nao estiver no mapa
- **Impacto estimado: -200KB+ do bundle principal**

**2. `src/App.tsx`** — Lazy load componentes nao-criticos
- Converter para lazy: `CookieConsent`, `PwaInstallBanner`, `FloatingHelpButton`, `BackToTopButton`, `MobileBottomNav`, `ScrollProgressBar`, `ProfileTypeChooser`
- Manter eager apenas: `ScrollToTop`, `ProtectedRoute`, `ModuleBoundary` (leves e necessarios)
- Usar `requestIdleCallback` wrapper para montar esses componentes apos o FCP

**3. `src/components/Header.tsx`** — Remover framer-motion do critical path
- Substituir `motion.img` da logo por CSS animation (`animate-fade-in` + scale via keyframe)
- Remover import de `motion` do Header

**4. `index.html`** — Remover preload da hero-bg-1.jpg
- O HeroBanner seleciona imagens aleatoriamente, entao o preload pode carregar uma imagem que nao sera usada
- Em vez disso, o HeroBanner pode usar `fetchpriority="high"` na imagem selecionada

**5. `src/pages/Index.tsx`** — Adiar query secundaria
- Adicionar `enabled: !!categories.length` ou um `setTimeout` para que `home-secondary-data` so execute apos o conteudo principal renderizar
- Simplificar a query de cities (usar dados ja existentes da tabela `cities` diretamente em vez da cadeia services→providers→cities)

**6. `src/main.tsx`** — Adiar MutationObserver
- Envolver o setup do MutationObserver em `requestIdleCallback` para nao bloquear o thread principal durante o boot

---

### Arquivos modificados
- `src/components/MobileBottomNav.tsx`
- `src/App.tsx`
- `src/components/Header.tsx`
- `index.html`
- `src/pages/Index.tsx`
- `src/main.tsx`

### Detalhes tecnicos

```text
Impacto esperado por mudanca:
┌──────────────────────────────────┬────────────┐
│ Mudanca                          │ Economia   │
├──────────────────────────────────┼────────────┤
│ Remover import * lucide-react    │ ~200KB JS  │
│ Lazy load 7 componentes App.tsx  │ ~80KB JS   │
│ framer-motion fora do Header     │ ~60KB JS*  │
│ Adiar home-secondary-data        │ -4 queries │
│ Remover preload hero desnecessario│ -1 request │
│ Adiar MutationObserver           │ -5ms boot  │
└──────────────────────────────────┴────────────┘
* se Header for o unico eager que usa framer-motion
```

Todas as mudancas sao retrocompativeis — nenhum comportamento visivel muda, apenas o timing de carregamento.

