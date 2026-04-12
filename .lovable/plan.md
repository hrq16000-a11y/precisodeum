

# Correção: 2 Arquivos Ainda Renderizam Ícones como Texto

## Status da Correção Anterior

Os arquivos principais (`CategoryIcon.tsx`, `SearchBar.tsx`, `CategoriesGrid.tsx`, `CategoriesListPage.tsx`) estão **corrigidos** -- usam o componente `<CategoryIcon>` corretamente e nunca exibem o nome do ícone como texto.

## Problemas Restantes

Encontrei **2 arquivos** que ainda renderizam `{icon} {name}` como texto puro (ex: "Hammer Marceneiro"):

| Arquivo | Linha | Problema |
|---------|-------|----------|
| `src/components/admin/UserTable.tsx` | 177 | `{(provider.categories as any)?.icon} {(provider.categories as any)?.name}` |
| `src/components/admin/ProviderEditDialog.tsx` | 118 | `{c.icon} {c.name}` dentro de `<SelectItem>` |

## Correções

### 1. UserTable.tsx (linha 177)
Substituir texto puro por:
```tsx
<CategoryIcon icon={(provider.categories as any)?.icon} size={14} className="text-muted-foreground" />
{(provider.categories as any)?.name}
```

### 2. ProviderEditDialog.tsx (linha 118)
Substituir por:
```tsx
<SelectItem key={c.id} value={c.id}>
  <span className="inline-flex items-center gap-1.5">
    <CategoryIcon icon={c.icon} size={14} /> {c.name}
  </span>
</SelectItem>
```

Ambos precisam do import de `CategoryIcon`.

Todos os outros 11 arquivos que referenciam `.icon` já usam `<CategoryIcon>` corretamente.

