

## Plano: Otimizacoes de Performance — Fase 2

### Analise

A fase anterior resolveu os maiores gargalos (wildcard lucide, lazy load de componentes, framer-motion no Header). Agora restam otimizacoes de medio impacto que, somadas, reduzem mais ~100-150ms do tempo de carregamento.

---

### Alteracoes

**1. `src/hooks/useSiteSettings.ts`** — staleTime 60s para 5min

O `site_settings` e consultado em cada pagina (via feature flags) com staleTime de apenas 60s, gerando refetches desnecessarios. Todas as outras queries usam 5min.

- Alterar `staleTime: 60000` para `staleTime: 1000 * 60 * 5`

**2. `src/App.tsx`** — Lazy load do OAuthRedirectHandler

O `OAuthRedirectHandler` e importado eagerly (linha 132) mas so e necessario na rota `/~oauth`. Converte-lo para lazy reduz o bundle inicial.

- Trocar `import OAuthRedirectHandler` por `const OAuthRedirectHandler = reactLazy(...)`

**3. `src/App.tsx`** — Lazy load do CurtainReveal

O `CurtainReveal` e importado eagerly (linha 146) mas so executa em modo PWA standalone. Converte-lo para lazy evita carregar codigo inutil em 95%+ dos acessos.

- Trocar `import CurtainReveal` por `const CurtainReveal = reactLazy(...)`

**4. `vite.config.ts`** — Chunk separado para lucide-react

Mesmo com o fix do wildcard no MobileBottomNav, `lucide-react` ainda e importado em dezenas de componentes e acaba no bundle principal. Isolar num chunk separado permite caching independente.

- Adicionar `'vendor-icons': ['lucide-react']` ao `manualChunks`

**5. `src/components/home/HeroBanner.tsx`** — fetchpriority="high" na imagem ativa

A imagem do hero e o maior LCP candidate. Adicionar `fetchPriority="high"` garante que o browser priorize o download dela sobre outros recursos.

- Na tag `<img>` da imagem ativa do carrossel, adicionar `fetchPriority="high"`

**6. `src/hooks/useGeoCity.ts`** — Cache de 30 min para evitar refetches em navegacao

Atualmente, `startFetchIfNeeded()` roda toda vez que o hook monta (toda navegacao). Adicionar um TTL de 30 min no localStorage para evitar chamadas repetidas a edge function e IP APIs durante a mesma sessao.

- Adicionar `GEO_FETCH_TS` key e verificar se o ultimo fetch foi ha menos de 30 min antes de refazer

---

### Resumo de impacto

```text
Mudanca                              Economia estimada
─────────────────────────────────────────────────────
staleTime site_settings 60s → 5min   -4 queries/5min
Lazy OAuthRedirectHandler            -5KB bundle inicial
Lazy CurtainReveal                   -2KB bundle inicial
Chunk separado lucide-react          cache independente
fetchPriority="high" no hero         -100ms LCP
Cache 30min no geoCity               -2 network requests
─────────────────────────────────────────────────────
```

### Arquivos modificados
- `src/hooks/useSiteSettings.ts`
- `src/App.tsx`
- `vite.config.ts`
- `src/components/home/HeroBanner.tsx`
- `src/hooks/useGeoCity.ts`

