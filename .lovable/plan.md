
# Ocultar Categorias Sem Cadastros na Home

## Problema
Após a última alteração, o grid da home exibe todas as subcategorias, incluindo as que têm `count === 0`. O usuário quer voltar ao comportamento anterior: só mostrar categorias com prestadores ativos.

## Alterações em `src/components/home/CategoriesGrid.tsx`

1. **Linha 66** — Filtrar subcategorias: adicionar `&& c.count > 0`
2. **Linha 86** — Filtrar chips: mostrar apenas macros que têm pelo menos uma subcategoria com providers
3. **Remover** o badge "Em breve" e a classe `opacity-50` dos cards (já não haverá cards com count 0)

### De → Para

| Local | Atual | Novo |
|-------|-------|------|
| Subcategorias (L66) | `categories.filter(c => c.parent_id)` | `categories.filter(c => c.parent_id && c.count > 0)` |
| Chips (L85-87) | `return macros` | `const subParentIds = new Set(subcategories.map(s => s.parent_id)); return macros.filter(m => subParentIds.has(m.id));` |
| Card (L156~) | Lógica de `opacity-50` + badge "Em breve" | Remover ambos (não necessários) |
