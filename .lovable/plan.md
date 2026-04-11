

# Refatoramento do Motor de Busca — GPS-First com Ordenação por Proximidade

## Diagnóstico do Estado Atual

A plataforma já possui uma infraestrutura geo sólida:
- **GeoEngine v5.1** com resolução determinística e Haversine
- **SIL (Search Intelligence Layer)** com scoring geo+relevância
- **useGeoCity** com detecção por IP, GPS preciso e localStorage
- **GeoLocationChip** para controle manual de cidade/raio
- **CategoryPage** e **SearchPage** já filtram e ordenam por proximidade

**Problemas identificados:**
1. **CityPage** — lista profissionais sem nenhuma ordenação por distância (apenas `rating_avg DESC`)
2. **CitiesListPage** — lista "top cities" por contagem, não por proximidade do GPS do usuário
3. **ProviderCard** — não exibe a distância em km do profissional até o usuário
4. **SearchPage/CategoryPage** — não solicita GPS proativamente ao carregar; depende do chip ou da SearchBar
5. **CityPage** não usa `fetchProvidersLightweight` (query manual, sem ranking híbrido)
6. **Nenhuma tela bloqueia** a renderização de resultados genéricos quando GPS não está ativo — viola a regra de "bloqueio de listagem genérica"
7. **SearchBar** não mostra o raio de busca ativo ("Buscando a até X km de você")

## Plano de Implementação

### 1. ProviderCard — Exibir distância em km

**Arquivo:** `src/components/ProviderCard.tsx`

- Adicionar prop opcional `distanceKm?: number` na interface
- Quando presente, exibir badge com `📍 2.3 km` ao lado da cidade
- Formatar: `< 1km` → "< 1 km", senão `X.X km`

### 2. DbProvider — Adicionar campo `_distanceKm`

**Arquivo:** `src/hooks/useProviders.tsx`

- Adicionar campo `distanceKm?: number` ao tipo `DbProvider`
- No `filterAndRankProvidersGrouped`, popular `distanceKm` no mapeamento final (já calcula `distanceKm` internamente, só não expõe)
- Expor no retorno `e.p` → `{ ...e.p, distanceKm: e.distanceKm }`

### 3. SearchPage — Melhorar UX geo-first

**Arquivo:** `src/pages/SearchPage.tsx`

- Adicionar banner contextual abaixo da SearchBar: "📍 Buscando profissionais a até {radiusKm}km de você" quando GPS ativo
- Quando GPS **não** ativo, exibir prompt amigável: "Ative sua localização para resultados mais precisos" com botão que chama `requestPreciseLocation()`
- Passar `distanceKm` para cada `ProviderCard`

### 4. CategoryPage — GPS proativo + distância nos cards

**Arquivo:** `src/pages/CategoryPage.tsx`

- Chamar `requestPreciseLocation()` em `useEffect` ao montar (como SearchPage já faz)
- Calcular e passar `distanceKm` para cada `ProviderCard`
- Adicionar banner de raio ativo ("Mostrando profissionais a até {radiusKm}km")
- Se GPS não ativo: prompt de localização antes dos resultados

### 5. CityPage — Refatorar para usar ranking por proximidade

**Arquivo:** `src/pages/CityPage.tsx`

- Integrar `useGeoCity` para obter coordenadas do usuário
- Usar `fetchProvidersLightweight` em vez de query manual (ranking híbrido)
- Ordenar por distância (Haversine) quando GPS disponível
- Calcular e passar `distanceKm` para cada `ProviderCard`
- Adicionar GeoLocationChip ao hero
- Exibir prompt de GPS quando não ativo

### 6. CitiesListPage — Ordenar cidades por proximidade

**Arquivo:** `src/pages/CitiesListPage.tsx`

- Na lista "top cities", quando GPS disponível, ordenar por distância do usuário (usando coordenadas da cidade na tabela `cities`) em vez de contagem
- Manter contagem como informação secundária
- Exibir distância ao lado de cada cidade (ex: "Curitiba, PR — 12 km")
- Os estados no grid também podem priorizar o estado do usuário primeiro

### 7. SearchBar — Indicador de raio ativo

**Arquivo:** `src/components/SearchBar.tsx`

- Quando `geoCity` e GPS ativos, exibir micro-badge no placeholder ou abaixo da barra: "📍 {geoCity} · {radiusKm}km"
- Integrar `radiusKm` e `latitude/longitude` do `useGeoCity`

### 8. Bloqueio de Listagem Genérica (UX safeguard)

Em todas as páginas com listagem (SearchPage, CategoryPage, CityPage, CitiesListPage):
- Se GPS não disponível E nenhuma cidade detectada por IP → exibir um card prominente pedindo localização antes dos resultados
- Os resultados ainda aparecem (para não bloquear totalmente), mas com aviso visual forte: "⚠️ Resultados sem filtro de localização — ative o GPS para ver profissionais perto de você"
- Este banner fica fixo no topo dos resultados

## Detalhes Técnicos

| Arquivo | Alteração |
|---|---|
| `src/components/ProviderCard.tsx` | Prop `distanceKm` + badge visual |
| `src/hooks/useProviders.tsx` | Expor `distanceKm` no retorno do grouped/filtered |
| `src/pages/SearchPage.tsx` | Banner de raio, prompt de GPS, distância nos cards |
| `src/pages/CategoryPage.tsx` | GPS proativo, distância nos cards, banner de raio |
| `src/pages/CityPage.tsx` | Refatorar query, ordenar por distância, GPS integration |
| `src/pages/CitiesListPage.tsx` | Ordenar cidades por proximidade GPS |
| `src/components/SearchBar.tsx` | Micro-badge de localização/raio |

Sem migração de banco necessária. Sem nova Edge Function.

