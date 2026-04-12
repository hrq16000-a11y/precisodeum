

# Correção: Remover Contagem de Profissionais dos Cards de Categorias

## Problema
Três arquivos ainda exibem a quantidade de profissionais nas categorias (ex: "● 6 profissionalis"). Além disso, há um bug de pluralização — `profissional` + `is` = "profissionalis" (errado), deveria ser "profissionais".

## Correção
Remover completamente os badges de contagem de profissionais dos cards de categoria em **todos** os 3 arquivos:

| Arquivo | O que remover |
|---------|---------------|
| `src/pages/CategoriesListPage.tsx` | Linhas 93-98: bloco `{cat.count > 0 && (...)}` |
| `src/components/home/CategoriesGrid.tsx` | Linhas 108-113: bloco `{cat.count > 0 && (...)}` |
| `src/components/CategoryCard.tsx` | Linha 45: `<span>...profissionais</span>` |

Nenhum outro arquivo no projeto exibe contagem de profissionais em cards de categoria.

