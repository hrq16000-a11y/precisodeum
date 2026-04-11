

# Chips de Categorias Inteligentes na Busca (GPS + Proximidade)

## Problema

- Os chips de sugestão na SearchPage mostram as primeiras 6 categorias **sem verificar se têm prestadores cadastrados**
- Não há ordenação por proximidade GPS
- O GPS não é solicitado proativamente ao abrir a página de busca

## Solução

### 1. Novo hook `useGeoCategories` (src/hooks/useProviders.tsx)

Query que retorna apenas categorias com prestadores aprovados, incluindo coordenadas dos prestadores para cálculo de proximidade:

```sql
SELECT c.name, c.slug, c.icon,
  COUNT(p.id) as provider_count,
  json_agg(json_build_object('lat', p.latitude, 'lon', p.longitude))
    FILTER (WHERE p.latitude IS NOT NULL) as coords
FROM categories c
JOIN providers p ON p.category_id = c.id
  AND p.status = 'approved' AND p.deleted_at IS NULL
GROUP BY c.id
ORDER BY COUNT(p.id) DESC
```

No client-side, com coordenadas GPS do usuário:
- Calcular distância mínima (Haversine) do prestador mais próximo de cada categoria
- Ordenar por menor distância primeiro
- Embaralhar parcialmente para variedade visual
- Sem GPS disponível: fallback para `provider_count` DESC + shuffle

### 2. Solicitar GPS ao montar SearchPage (src/pages/SearchPage.tsx)

- Chamar `requestPreciseLocation()` do `useGeoCity` via `useEffect` ao montar a página
- Já existe a função no hook, só não é chamada na SearchPage

### 3. Atualizar chips na SearchPage (src/pages/SearchPage.tsx)

- Substituir `suggestionChips` (linhas 149-155) para usar `useGeoCategories` em vez de `suggestions?.categories`
- Mostrar apenas categorias com `provider_count > 0`
- Ordenar por proximidade GPS quando coordenadas disponíveis

## Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/hooks/useProviders.tsx` | Novo hook `useGeoCategories` com query filtrada e lógica de proximidade |
| `src/pages/SearchPage.tsx` | `useEffect` para GPS + chips dinâmicos via `useGeoCategories` |

A SearchBar **não será alterada** conforme solicitado.

