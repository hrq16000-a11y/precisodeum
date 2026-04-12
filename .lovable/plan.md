

# Exibir Todas as Categorias na Home (incluindo sem cadastros)

## Problema
O `CategoriesGrid` filtra subcategorias com `c.count > 0` (linha 66) e só mostra chips de macro-categorias que têm subcategorias com prestadores (linha 86-87). Isso esconde categorias vazias tanto no grid quanto nas guias.

## Alterações

### `src/components/home/CategoriesGrid.tsx`

1. **Subcategorias**: remover o filtro `c.count > 0` na linha 66 — mostrar todas as subcategorias independente de terem prestadores
2. **Chips**: remover o filtro na linha 86-87 — mostrar todas as macro-categorias como chips, não apenas as que têm subcategorias com providers
3. **Visual diferenciado**: categorias sem prestadores (`count === 0`) terão opacidade reduzida e um badge "Em breve" para indicar que ainda não há profissionais, mas continuam clicáveis

| Linha | De | Para |
|-------|-----|------|
| 66 | `categories.filter(c => c.parent_id && c.count > 0)` | `categories.filter(c => c.parent_id)` |
| 86-87 | `macros.filter(m => subParentIds.has(m.id))` | `macros` (sem filtro) |
| 156 | Card sempre com mesma opacidade | Se `count === 0`, adicionar `opacity-50` e badge "Em breve" |

