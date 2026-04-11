

# Correção: Ordenação por Proximidade no Dropdown de Cidades e Filtros

## Problema Identificado

A screenshot mostra dois problemas:

1. **Dropdown do GeoLocationChip**: Ao abrir, lista cidades em ordem alfabética (Abadia de Goiás, Abadia dos Dourados...) em vez de mostrar as cidades mais próximas do GPS do usuário
2. **"0 profissionalis"**: O raio de 5km é muito restritivo — não encontra nenhum profissional na categoria, mas não oferece sugestão de expandir

## Causa Raiz

- `GeoLocationChip` carrega 5.570 municípios da API IBGE sem coordenadas — impossível ordenar por distância
- `citiesIndex.ts` tem todos os municípios mas sem lat/lon
- `cityCoords.ts` tem ~200 cidades com coordenadas — suficiente para sortear as mais próximas no dropdown
- Quando não há resultados locais, o raio deveria auto-expandir ou sugerir expansão

## Solução

### 1. GeoLocationChip — Cidades ordenadas por proximidade

**Arquivo:** `src/components/GeoLocationChip.tsx`

- Importar `cityCoords.ts` (lookup por nome normalizado)
- Quando GPS disponível e sem texto de busca: calcular distância Haversine para cada cidade que tem coordenadas conhecidas, ordenar do mais próximo ao mais distante
- Cidades sem coordenadas conhecidas ficam no final
- Mostrar a distância ao lado de cada cidade no dropdown (ex: "Curitiba PR — 3km")

### 2. Migração DB — Adicionar lat/lon à tabela `cities`

- Adicionar colunas `latitude DOUBLE PRECISION` e `longitude DOUBLE PRECISION` à tabela `cities`
- Backfill inicial usando média das coordenadas dos providers de cada cidade (já temos 100% de cobertura de coords nos providers)

### 3. GeoLocationChip — Priorizar cidades com providers

- Em vez de carregar da API IBGE, carregar da tabela `cities` que agora tem coordenadas
- Filtrar para mostrar apenas cidades que têm `has_providers = true` primeiro
- Ordenar por distância GPS
- Fallback para IBGE apenas quando o usuário busca uma cidade que não está na tabela

### 4. CategoryPage — Auto-expansão inteligente do raio

**Arquivo:** `src/pages/CategoryPage.tsx`

- Quando `localProviders.length === 0` e GPS está ativo, mostrar sugestão de expandir raio automaticamente
- Botão "Expandir para 50km" ou "Expandir para todo o estado"
- Exibir contagem de profissionais disponíveis em raios maiores

## Detalhes Técnicos

| Arquivo | Alteração |
|---|---|
| Migração SQL | `ALTER TABLE cities ADD COLUMN latitude/longitude` + backfill via subquery de providers |
| `src/components/GeoLocationChip.tsx` | Carregar cidades do DB com coords, ordenar por proximidade GPS, mostrar distância |
| `src/pages/CategoryPage.tsx` | Auto-sugestão de expansão de raio quando 0 resultados locais |
| `src/lib/geoUtils.ts` | Nova função `fetchCitiesWithCoords()` que consulta tabela `cities` |

