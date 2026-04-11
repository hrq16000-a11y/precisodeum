

## Plano: Otimizacoes de Performance — Fase 4

### Oportunidades restantes

Apos 3 fases de otimizacao, os maiores gargalos ja foram resolvidos. As melhorias restantes sao incrementais mas ainda significativas, especialmente no contexto PWA/mobile.

---

### Alteracoes

**1. `src/pages/Index.tsx`** — Lazy load SearchBar e GeoLocationChip do HeroBanner

O `HeroBanner` importa eagerly `SearchBar` (355 linhas, com useQuery + supabase) e `GeoLocationChip` (268 linhas, com supabase + geoDistance). Ambos estao no critical path mas nao sao necessarios para o LCP (a imagem hero e o titulo sao o LCP). Converter para lazy dentro do HeroBanner permitiria que a imagem hero renderize antes.

- No `HeroBanner.tsx`: lazy load `SearchBar` e `GeoLocationChip` com Suspense skeleton
- Manter `RotatingServiceText` eager (e leve e parte do titulo)

**2. `src/components/Footer.tsx`** — Lazy load SponsorAd e PwaFooterInstall

O Footer importa eagerly `SponsorAd` e `PwaFooterInstall`. Como o Footer e lazy no Index, isso e menos critico, mas esses imports puxam hooks adicionais (useSponsors, usePwaInstall) que geram queries desnecessarias se o usuario nem scrollar ate o fim.

- Converter `SponsorAd` e `PwaFooterInstall` para lazy no Footer

**3. `src/hooks/useGeoCity.ts`** — Evitar re-render cascading

O hook `useGeoCity` e chamado 3 vezes no critical path: Header, HeroBanner, e SearchBar. Cada instancia roda a mesma logica. Mover para um React Context no App.tsx evitaria chamadas duplicadas e re-renders em cascata.

- Criar `GeoProvider` simples no App.tsx que chama `useGeoCity()` uma vez
- Header, HeroBanner, SearchBar consomem via `useContext` em vez de chamar o hook diretamente

**4. `src/pages/Index.tsx`** — Consolidar queries `home-counts` com `home-secondary-data`

Atualmente ha 2 queries separadas (`home-counts` e `home-secondary-data`) que poderiam ser uma so, reduzindo 2 round-trips ao Supabase para 1.

- Mover os counts (services, jobs) para dentro da query `home-secondary-data`
- Remover query `home-counts` separada

**5. `index.html`** — Adicionar `modulepreload` para o entry point

O browser precisa descobrir o grafo de modulos sequencialmente. Adicionar `<link rel="modulepreload">` para o entry chunk principal permite que o browser comece a baixar os modulos criticos em paralelo com o HTML parsing.

- Nao faremos manualmente (Vite ja gera isso no build). Em vez disso, verificar se o Vite esta gerando corretamente e, se nao, adicionar o plugin `vite-plugin-preload`.

**6. `src/components/home/HeroBanner.tsx`** — Usar CSS `content-visibility: auto` nas secoes abaixo do hero

Adicionar `content-visibility: auto` e `contain-intrinsic-size` nos wrappers de secao lazy do Index.tsx para que o browser pule o rendering de secoes fora da viewport.

- No `Index.tsx`, adicionar `style={{ contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}` nos wrappers de secao abaixo do fold

---

### Resumo de impacto

```text
Mudanca                                    Economia estimada
────────────────────────────────────────────────────────────
Lazy SearchBar + GeoLocationChip           ~40KB fora do LCP
Lazy SponsorAd + PwaFooterInstall          ~15KB (Footer)
GeoProvider context (eliminar duplicatas)  -2 re-renders cascata
Consolidar home-counts + secondary-data    -1 round-trip Supabase
content-visibility: auto nas secoes        -rendering offscreen
────────────────────────────────────────────────────────────
```

### Arquivos modificados
- `src/components/home/HeroBanner.tsx`
- `src/components/Footer.tsx`
- `src/App.tsx` (GeoProvider)
- `src/pages/Index.tsx`

