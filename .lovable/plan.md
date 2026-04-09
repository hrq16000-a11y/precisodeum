

# Criar página backup pg03 — Clone estático da home atual

## O que será feito

Criar uma cópia congelada da homepage atual (`Index.tsx`) como `Index03.tsx`, acessível em `/pg03.html`, `/pg03` e `/index03`. Essa página exibirá **todas as seções sem filtros de feature flags** — tudo visível, sempre — para você ver o que está oculto.

## Diferenças em relação à home oficial

| Home oficial (Index.tsx) | Backup pg03 (Index03.tsx) |
|---|---|
| Seções controladas por feature flags | **Todas as seções sempre visíveis** |
| Ordem dinâmica via `site_settings` | **Ordem fixa hardcoded** |
| UrgencyBanner some se count=0 | **Sempre exibido** |
| Cache keys compartilhadas | **Cache keys exclusivas (`index03-*`)** |

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/Index03.tsx` | **Criar** — Clone da home com todas as seções fixas, sem feature flags, sem ordem dinâmica |
| `src/App.tsx` | **Editar** — Adicionar rotas `/pg03`, `/pg03.html`, `/index03` |

## Estrutura da Index03

Seguirá o mesmo padrão do `Index02.tsx`:
- Importações diretas dos mesmos componentes da home atual
- Inclui **todas** as seções: UrgencyBanner, LeaderSponsor, SponsorTopBanner, StatsCounter, HighlightsCarousel, CategoriesGrid, PwaInstall, DynamicPageBlocks, AdBanner, FeaturedProviders, PopularServices, RecentServices, FeaturedJobs, BlogHighlight, CitiesSection, CtaSection, AdShowcase, SponsorsSection, HowItWorks, PopularSearches, TestimonialsSection, FaqSection, SponsorFooterCTA
- Query keys prefixadas com `index03-` para não colidir com a home
- Canonical apontando para `/pg03`
- Nenhum vínculo com `site_settings`, `useFeatureEnabled` ou `useSettingValue`

