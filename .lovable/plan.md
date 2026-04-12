# Plano: Auditoria e Correção de Categorias, Ícones e Busca

## Problemas Identificados

1. **Ícones renderizando como texto na busca** — No `SearchBar.tsx` (linha 247), o campo `s.icon` (ex: "Hammer", "Pipette") é renderizado diretamente como texto dentro do `<span>`, em vez de usar o componente `CategoryIcon`. Isso causa a exibição de "HammerMarceneiro", "PipetteEncanador" etc.
2. **Ícones renderizando como texto na home** — O `CategoryIcon` possui um fallback que exibe o nome do ícone como texto quando a busca no objeto `icons` do lucide-react falha. Isso pode ocorrer por diferenças de casing entre versões da biblioteca.
3. **Texto transbordando em mobile** — Nomes longos de categorias (ex: "Ar-condicionado", "Assessor de Imprensa") podem ultrapassar os limites dos cards em telas pequenas.
4. **Contagem inconsistente** — Na home, os cards não mostram a contagem de profissionais; na lista completa, mostram parcialmente.

---

## Correções Planejadas

### 1. Corrigir ícones na SearchBar

- Substituir `{s.icon || '🔧'}` por `<CategoryIcon icon={s.icon || ''} size={18} />` no dropdown de sugestões
- Garantir que trending queries também usem o componente `CategoryIcon`

### 2. Tornar CategoryIcon mais robusto

- Adicionar fallback de casing no componente: tentar PascalCase, tentar com primeira letra maiúscula, tentar lookup case-insensitive no objeto `icons`
- Manter o fallback visual como um ícone genérico (ex: `CircleDot`) em vez de renderizar o nome como texto

### 3. Ajustar responsividade dos cards de categoria

- Aplicar `text-xs` e `break-words` nos nomes longos dentro dos cards (CategoriesGrid e CategoriesListPage)
- Garantir `min-h` nos cards para altura consistente mesmo com nomes de 2 linhas

### 4. Padronizar exibição de contagem

- Adicionar badge de contagem de profissionais nos cards da home (CategoriesGrid) quando `count > 0`, igual ao padrão da CategoriesListPage

Corrigir globalmente.

---

## Arquivos Modificados


| Arquivo                                  | Alteração                                       |
| ---------------------------------------- | ----------------------------------------------- |
| `src/components/CategoryIcon.tsx`        | Lookup robusto + fallback visual genérico       |
| `src/components/SearchBar.tsx`           | Usar `CategoryIcon` no dropdown                 |
| `src/components/home/CategoriesGrid.tsx` | Adicionar badge de contagem + ajuste responsivo |
| `src/pages/CategoriesListPage.tsx`       | Ajuste responsivo em nomes longos               |
