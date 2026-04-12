
# Correção: Categorias sem Prestadores — Ocultar ou Sinalizar

## Problema
A página `/categorias` exibe todas as categorias do banco, inclusive as que não possuem nenhum prestador inscrito, sem distinção visual.

## Solução
Separar categorias **com** prestadores (exibir normalmente como links clicáveis) das **sem** prestadores (exibir em seção separada, visualmente desabilitadas, com mensagem "Ainda não temos prestadores nessa categoria. Participe!").

## Alterações

### 1. `src/pages/CategoriesListPage.tsx`
- Dividir `filtered` em dois arrays: `withProviders` (count > 0) e `withoutProviders` (count === 0).
- Renderizar `withProviders` no grid principal (com links clicáveis, como hoje).
- Abaixo, renderizar `withoutProviders` em um grid separado com:
  - Estilo opaco/desabilitado (`opacity-50`, sem hover, sem link)
  - Texto pequeno abaixo do nome: "Ainda não temos prestadores. Participe!"
  - Separador visual com título "Categorias em breve"
- O botão "Ver Mais" aplica-se apenas às categorias com prestadores.

### 2. `src/components/home/CategoriesGrid.tsx`
- Filtrar para exibir apenas categorias com `count > 0` na Home (ocultar totalmente as sem prestadores na página inicial).

### Arquivos modificados
- `src/pages/CategoriesListPage.tsx`
- `src/components/home/CategoriesGrid.tsx`
