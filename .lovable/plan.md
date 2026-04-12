

# Modernização do Grid de Categorias — Home

## O que será feito

### 1. Grid Responsivo Inteligente
- Mobile: `grid-cols-3` fixo para cards compactos com `equal height` via CSS grid `auto-rows: 1fr`
- Tablet+: manter `auto-fit` com `minmax(6rem, 1fr)`
- Cards sem `border` — usar apenas `shadow-[0_4px_6px_-1px_rgb(0_0_0/0.1)]`

### 2. Cards Modernos
- Remover bordas, usar sombra sutil
- Ícone protagonista: aumentar para `h-12 w-12` no mobile (era `h-10 w-10`), com `size={26}`
- Texto `text-[0.6875rem]` compacto, `line-clamp-2`, `hyphens: auto`
- Hover: escala sutil + sombra elevada

### 3. Chips de Filtro Rápido
- Linha horizontal scrollável acima do grid com os 7 macro-grupos do banco (categorias com `parent_id IS NULL`)
- Chip "Todos" selecionado por padrão
- Ao clicar num chip, filtra as subcategorias visíveis daquele grupo
- Estilo: `rounded-full bg-muted text-xs px-3 py-1.5`, ativo: `bg-accent text-white`

### 4. Animação de Entrada
- Usar `framer-motion` com stagger fade-in + slide-up (já existe padrão no projeto via `StaggeredList`)
- Cada card entra com delay escalonado de 0.04s

### 5. Empty State
- Se o filtro por chip não retorna resultados: ilustração com ícone `SearchX` + texto "Nenhuma categoria encontrada" + botão "Sugerir Categoria" (link para WhatsApp ou formulário)

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/components/home/CategoriesGrid.tsx` | Reescrever: chips de macro-categorias, grid 3-col mobile, cards sem borda, empty state, framer-motion stagger |

## Dados
- Macro-categorias vêm do mesmo array `categories` (filtrar `parent_id IS NULL`)
- Subcategorias: filtrar `parent_id === selectedMacro.id`
- O hook `useCategoriesWithCount` já traz todas as categorias — preciso verificar se traz `parent_id`

## Impacto
- Visual premium tipo app nativo
- Filtro rápido melhora descoberta de serviços
- Zero breaking changes — apenas componente da home alterado
- Animações consistentes com o design system existente

