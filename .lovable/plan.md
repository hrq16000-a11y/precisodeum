

# Mobile First — Melhorias de UX

## Problemas Identificados

1. **SearchPage: Filtros ocupam muito espaço no mobile** — A sidebar de filtros aparece inteira no topo no mobile, empurrando os resultados para baixo. Deveria ser um bottom sheet / drawer.
2. **SearchPage: Grid `sm:grid-cols-2` desperdiça espaço** — Em telas 375px os cards ficam em 1 coluna, mas a grid gap de 16px e padding poderiam ser reduzidos.
3. **ProviderCard: Badges demais em tela pequena** — "Super Perto!", "Atendimento Rápido", "Online", "Outra região", ProfileBadge, RankTier — todos em `flex-wrap` criam até 3 linhas de badges em mobile.
4. **SearchPage: Botão "Casa→Trabalho" escondido dentro dos filtros** — No mobile os filtros começam fechados, então o botão de rota é invisível.
5. **CategoryPage: Hero section muito alto no mobile** — `py-12` + ícone 80px + badges + GeoLocationChip consome quase toda a viewport.
6. **FeaturedProviders: Cards com padding excessivo** — `p-5` no mobile poderia ser `p-4`.
7. **HeroBanner: CTAs empilhados sem hierarquia visual** — Os dois links de CTA ficam muito pequenos e sem destaque visual no mobile.
8. **Container padding** — `container` do Tailwind usa padding padrão, mas várias seções adicionam `px-4` manualmente criando inconsistência.

## Alterações

### 1. `src/pages/SearchPage.tsx` — Filtros como Drawer no mobile
- No mobile, converter a sidebar de filtros em um `Drawer` (bottom sheet) ativado por botão flutuante
- Mover o botão "Casa→Trabalho" para fora dos filtros, visível como chip no topo dos resultados
- Reduzir padding do container de resultados: `py-6` → `py-4` no mobile
- Sort rápido: adicionar chips horizontais scrolláveis (Relevância, Mais Perto, Avaliação) acima da grid no mobile em vez de select

### 2. `src/components/ProviderCard.tsx` — Layout compacto mobile
- Reduzir padding: `p-[1.25rem]` → `p-3 sm:p-[1.25rem]`
- Avatar: `h-14 w-14` → `h-12 w-12 sm:h-14 sm:w-14`
- Limitar badges visíveis no mobile a 3 (mais relevantes), com "..." overflow
- Distância + tempo estimado: combinar numa única linha mais compacta
- Botões de ação: altura reduzida no mobile

### 3. `src/pages/CategoryPage.tsx` — Hero compacto mobile
- Reduzir padding do hero: `py-12` → `py-6 md:py-12`
- Ícone da categoria: `h-20 w-20` → `h-14 w-14 md:h-20 md:w-20`
- Título: `text-3xl` → `text-2xl md:text-3xl`
- Grid: `gap-4` → `gap-3 sm:gap-4`

### 4. `src/components/home/HeroBanner.tsx` — CTA com mais destaque mobile
- CTA primário: converter em botão com fundo `bg-secondary` no mobile em vez de apenas texto link
- Reduzir `min-h-[320px]` → `min-h-[280px]` no mobile
- Título: `text-3xl` → `text-2xl sm:text-3xl`

### 5. `src/components/home/FeaturedProviders.tsx` — Grid e padding otimizados
- Padding dos cards: `p-5` → `p-3.5 sm:p-5`
- Grid gap: `gap-4` → `gap-3 sm:gap-4`
- Avatar: `h-16 w-16` → `h-12 w-12 sm:h-16 sm:w-16`
- Seção: `py-14` → `py-8 md:py-14`

### 6. `src/components/home/CategoriesGrid.tsx` — Micro-ajustes
- Seção: `py-12` → `py-8 md:py-12`
- Grid `minmax(9rem, 1fr)` → `minmax(5rem, 1fr) sm:minmax(9rem, 1fr)` para 3 colunas em telas 320px
- Ícone de categoria: `h-14 w-14` → `h-10 w-10 sm:h-14 sm:w-14`

### 7. `src/components/RouteSearchModal.tsx` — Full screen no mobile
- Usar `DialogContent` com `className="sm:max-w-md max-h-[90vh]"` e scroll interno

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/pages/SearchPage.tsx` | Filtros como Drawer mobile, chips de sort, padding reduzido |
| `src/components/ProviderCard.tsx` | Layout compacto: padding, avatar, badges limitados |
| `src/pages/CategoryPage.tsx` | Hero compacto mobile |
| `src/components/home/HeroBanner.tsx` | CTA destacado, altura reduzida |
| `src/components/home/FeaturedProviders.tsx` | Grid e padding otimizados |
| `src/components/home/CategoriesGrid.tsx` | Grid responsivo para 320px |
| `src/components/RouteSearchModal.tsx` | Fullscreen mobile |

## Impacto
- Mais conteúdo visível above-the-fold no mobile
- Filtros não empurram resultados — ficam num drawer
- Cards mais compactos = menos scroll para encontrar profissionais
- CTAs maiores = mais conversão mobile
- Zero breaking changes desktop — todas as mudanças são `sm:` / `md:` condicionais

