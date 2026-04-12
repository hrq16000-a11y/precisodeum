

# Ajuste de UI: Responsividade Global e Suporte a Fontes Grandes

## Arquivos a alterar

### 1. `src/index.css` — Regras globais de tipografia e acessibilidade
Adicionar na `@layer base`:
```css
* {
  overflow-wrap: break-word;
  word-break: break-word;
}
```

### 2. `src/pages/CategoriesListPage.tsx` — Grid adaptativo + padding relativo
- **Grids** (linhas 78, 86, 135): trocar `grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4` por grid CSS com `auto-fit`:
  - Usar `style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))' }}` + `className="grid gap-3"`
- **Cards** (linhas 99, 139): trocar `p-3` por `p-[0.75rem]`, `min-h-[56px]` por `min-h-[3.5rem]`, e `gap-2.5` por `gap-[0.625rem]` (unidades rem)
- **Textos**: adicionar `hyphens-auto` style nos labels de nome de categoria
- **Ícone container**: trocar `h-10 w-10` por `min-h-[2.5rem] min-w-[2.5rem]` para flexibilidade

### 3. `src/components/home/CategoriesGrid.tsx` — Grid adaptativo + cards flexíveis
- **Grids** (linhas 76, 83): trocar `grid-cols-2 gap-3 md:grid-cols-4` por `grid gap-3` com `style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))' }}`
- **Card** (linha 92): trocar `min-h-[120px]` por `min-h-[7.5rem]`, `p-5` por `p-[1.25rem]`
- **Ícone**: trocar `h-14 w-14` por `min-h-[3.5rem] min-w-[3.5rem] h-14 w-14`
- **Texto**: adicionar `style={{ hyphens: 'auto', overflowWrap: 'break-word' }}`

### 4. `src/components/CategoryCard.tsx` — Card flexível
- Trocar `p-5` por `p-[1.25rem]`
- Trocar `h-12 w-12` por `min-h-[3rem] min-w-[3rem] h-12 w-12`
- Adicionar `style={{ hyphens: 'auto', overflowWrap: 'break-word' }}` no label de texto

### 5. `src/components/SearchBar.tsx` — Container flex-wrap
- Garantir que o container de input + botões use `flex-wrap` para não cortar em telas menores

## Resumo
- Grids com `auto-fit + minmax` em vez de colunas fixas
- `overflow-wrap: break-word` global + `hyphens: auto` nos labels
- Unidades `rem` para paddings/margins
- `min-h` em vez de `h` fixo nos cards
- `flex-wrap` na barra de busca
- Tudo compatível com zoom de fonte até 150%

