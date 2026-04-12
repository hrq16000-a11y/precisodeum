

# Auditoria Completa: Ainda Existem 4 Arquivos com Ícones Renderizados como Texto

## Status Atual

Os seguintes arquivos já estão **corrigidos** e usam `<CategoryIcon>`:
- `CategoryIcon.tsx`, `SearchBar.tsx`, `CategoriesGrid.tsx`, `CategoriesListPage.tsx`
- `UserTable.tsx`, `ProviderEditDialog.tsx`
- `CategoryPage.tsx`, `CityDetailPage.tsx`, `DashboardProfilePage.tsx`, `DashboardServicesPage.tsx`, `ProviderProfile.tsx`, `ServiceWizard.tsx`, `PopularServicePage.tsx`, `AdminPopularServicesPage.tsx`

## Arquivos com Bug (renderizam `{.icon}` como texto puro)

| Arquivo | Linhas | Problema |
|---------|--------|----------|
| `src/pages/SignupPage.tsx` | 567, 576, 586 | `{macro.icon} {macro.name}` e `{sub.icon} {sub.name}` no dropdown de categorias do cadastro |
| `src/pages/SearchPage.tsx` | 235 | `{c.icon} {c.name}` no `<SelectItem>` de filtro de categorias |
| `src/pages/JobsPage.tsx` | 411, 475 | `{c.icon} {c.name}` no filtro de categorias (select e sidebar) |
| `src/pages/DashboardJobsPage.tsx` | 437 | `{(job.categories as any)?.icon} {(job.categories as any)?.name}` na listagem de vagas |

## Correções

### 1. SignupPage.tsx — 3 pontos
Substituir texto puro por `<CategoryIcon>` nos 3 locais do dropdown de categorias:
- Linha 567: header do grupo macro
- Linha 576: botão de subcategoria
- Linha 586: botão de categoria sem subs

### 2. SearchPage.tsx — 1 ponto
Substituir `{c.icon} {c.name}` por `<span className="inline-flex items-center gap-1.5"><CategoryIcon icon={c.icon} size={14} /> {c.name}</span>` no `<SelectItem>`.

### 3. JobsPage.tsx — 2 pontos
- Linha 411: no `<option>` do select nativo, ícones SVG não funcionam. Solução: remover `{c.icon}` e deixar apenas `{c.name}`.
- Linha 475: no botão da sidebar, substituir por `<CategoryIcon>` + nome.

### 4. DashboardJobsPage.tsx — 1 ponto
Linha 437: substituir `{(job.categories as any)?.icon}` por `<CategoryIcon icon={...} size={12} />`.

## Nota Técnica
O elemento `<option>` do HTML nativo (JobsPage linha 411) não aceita componentes React/SVG dentro dele. A solução é remover o ícone ali ou converter para um componente `<Select>` do shadcn/ui.

## Resumo
Após estas 4 correções, **100% dos arquivos** do projeto estarão usando `<CategoryIcon>` corretamente — sem nenhum nome de ícone aparecendo como texto em nenhuma parte do site (frontend, dashboard, admin, cadastro, busca, vagas).

