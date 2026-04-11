

# Melhorar Legibilidade dos Breadcrumbs

## Problema
Os breadcrumbs na página de categoria (e páginas similares com fundo escuro) estão ilegíveis — texto `text-primary-foreground/50` (50% de opacidade) sobre fundo azul escuro (`bg-hero`), como mostra o screenshot.

## Solução
Redesenhar o componente Breadcrumbs com um fundo semi-transparente (glass pill), texto mais claro e tamanho ligeiramente maior quando usado sobre fundos escuros. Adicionar uma prop `variant` para alternar entre o estilo padrão (fundo claro) e o estilo "hero" (fundo escuro).

## Alterações

### 1. `src/components/Breadcrumbs.tsx`
- Adicionar prop `variant?: 'default' | 'hero'`
- Quando `variant="hero"`:
  - Envolve num pill com `bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/15`
  - Texto base: `text-white/70`, links hover: `text-white`, último item: `text-white font-semibold`
  - Separadores: `text-white/40`
  - Ícone Home: `text-white/60`
  - Fonte `text-sm` em vez de `text-xs`

### 2. `src/pages/CategoryPage.tsx`
- Passar `variant="hero"` no Breadcrumbs
- Remover a classe `text-primary-foreground/50` do className

### 3. Outras páginas com fundo escuro (se aplicável)
- `CityDetailPage.tsx`, `CityPage.tsx` — verificar se breadcrumbs estão sobre fundo escuro e aplicar `variant="hero"` se necessário

