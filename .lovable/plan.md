
# Correção: Busca com Prioridade por Proximidade + Separação Regional

## Problema Identificado

A `SearchPage` recebe os resultados de `filterAndRankProviders` como uma lista plana, sem distinção visual entre profissionais locais e de outras regiões. O ranking existe internamente (SIL + GeoEngine), mas:

1. **Sem separação visual** — locais e remotos aparecem misturados
2. **Sem distância real** — dentro dos locais, não ordena por km (usa geoScore genérico)
3. **Sem botão "Ver outras regiões"** — como já existe na CategoryPage

A CategoryPage já resolve isso com `localProviders` / `otherProviders` + botão de expansão. A SearchPage precisa do mesmo padrão.

---

## Solução

### 1. `useProviders.tsx` — Expor metadata de local/remoto

Criar uma nova função `filterAndRankProvidersGrouped` (ou modificar a existente) que retorna:

```text
{
  local: DbProvider[],      // Matches geo context
  other: DbProvider[],      // Doesn't match
  intent: SearchIntent,
  isFallback: boolean        // true when 0 local results
}
```

- Dentro de `local`, ordenar por **distância real** (Haversine) quando userLat/userLon disponíveis, depois por _finalScore
- Dentro de `other`, manter ordem por _finalScore

Criar `useSearchProvidersGrouped` que expõe essa estrutura ao invés do array plano.

### 2. `SearchPage.tsx` — Separação visual + botão de expansão

- Usar `useSearchProvidersGrouped` ao invés de `useSearchProviders`
- Exibir seção **"Na sua região"** com contagem e badge de localização
- Abaixo, botão **"Ver outras localidades"** (mesmo padrão visual da CategoryPage: ícone Globe, contagem, card-like button)
- Ao expandir, mostrar separador **"Outras regiões"** com linha horizontal
- Cards de "outras regiões" recebem `isFallback={true}` automaticamente (já mostra badge "Outra região")
- Quando 0 locais: mostrar aviso + todos os resultados como fallback nacional

### 3. Melhoria no ranking de proximidade

Dentro dos resultados locais, adicionar **distância real em km** como critério primário de ordenação:
- Se GPS disponível + provider tem coords → Haversine → sort ascending
- Sem GPS → manter geoScore + _finalScore atual

---

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/hooks/useProviders.tsx` | Nova função `filterAndRankProvidersGrouped` + hook `useSearchProvidersGrouped` |
| `src/pages/SearchPage.tsx` | Consumir grouped results, separar local/outros, botão expansão, contadores por seção |

Sem mudanças de banco de dados. Reutiliza toda a infra de GeoEngine/SIL existente.
