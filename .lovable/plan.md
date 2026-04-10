

# GEO Intelligence v4 — Cobertura Nacional Completa

## Problema atual
O sistema reconhece apenas ~200 cidades hardcoded em `CITY_COORDS`. Qualquer busca por cidade fora dessa lista (ex: "Encanador em Chapecó" ou "Advogado Londrina PR") falha silenciosamente. A detecção de cidade no query só funciona por sufixo (right-to-left), falhando para cidades no meio da string.

## Solução

### 1. Criar `src/lib/citiesIndex.ts` — Base nacional IBGE (5.570 cidades)

Arquivo estático gerado a partir da API IBGE, contendo todas as cidades brasileiras indexadas por nome normalizado:

```text
type CityEntry = { name: string; state: string; lat: number; lon: number }
type CitiesIndex = Record<string, CityEntry>  // key = normalize(name)
type CitiesByNormState = Record<string, CityEntry[]>  // key = normalize(name+state)
```

- Gerar via script que consulta IBGE API + Nominatim para coords das 200+ maiores (as demais usam coords do IBGE quando disponível)
- Para cidades sem coords, armazenar `lat: null, lon: null` (o sistema já trata fallback)
- Indexar por `normalize(city)` e por `normalize(city + state)` para resolver ambiguidades como "São José"
- Exportar função `lookupCity(norm: string, stateNorm?: string): CityEntry | null`

### 2. Criar `src/lib/ufIndex.ts` — Detecção de UF no query

Mapa de UFs brasileiras para detecção de padrões como "Curitiba PR", "Curitiba/PR", "SP":

```text
UF_MAP: Record<string, string> = { sp: 'SP', rj: 'RJ', pr: 'PR', ... }
```

- Detectar UF como último token do query (2 letras) ou após `/` ou `-`
- Usar para desambiguação: "São José SC" vs "São José SP"
- Se query é apenas uma UF (ex: "SP"), tratar como estado inteiro

### 3. Refatorar detecção geo em `filterAndRankProviders`

Substituir a lógica atual (linhas 526-571) por sliding window bidirecional:

```text
1. Extrair UF se presente (regex: /\b([A-Z]{2})$/ ou /\/([A-Z]{2})$/)
2. normalize(query) → tentar resolveMetroRegion() (mantém v3)
3. Se não metro → sliding window em TODOS os tokens (não só sufixo):
   - Para cada par (i, j), candidato = tokens[i..j].join('')
   - Match contra: citiesIndex > CITY_COORDS > metroRegions
   - Escolher match MAIS LONGO (mais específico)
   - Se UF detectada, priorizar match com UF correspondente
4. Separar termos geo dos termos de serviço
5. Manter pipeline existente (Haversine → RM → fuzzy → estado)
```

### 4. Expandir aliases regionais em `metroRegions.ts`

Adicionar ao `REGIONAL_ALIASES`:
- `abc` → `saopaulo`
- `grandebh` → `belohorizonte`
- `grandevitoria` → `vitoria`
- `baixadasantista` → `santos` (já existe, verificar)
- `litoralpaulista` → `santos`
- `valedo paraiba` → lookup especial (não é metro simples)

Adicionar RMs faltantes: **Campinas**, **Vale do Paraíba**, **Baixada Santista**, **Manaus**, **Brasília/RIDE**.

### 5. Atualizar `getCityCoords` para usar citiesIndex como fallback

```text
getCityCoords(city):
  1. Checar CITY_COORDS (cache estático, ~200 cidades) → O(1)
  2. Se não: checar citiesIndex → O(1)
  3. Se não: null
```

### 6. Performance

- `citiesIndex` é um `Record<string, ...>` — lookup O(1)
- Sliding window é O(n^2) nos tokens do query, mas queries têm max ~6 tokens → negligível
- Manter cache/memo existente em `normalize()` e `coordsCache`
- citiesIndex carregado uma vez (import estático)

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/lib/citiesIndex.ts` | **CRIAR** — index nacional de cidades |
| `src/lib/ufIndex.ts` | **CRIAR** — mapa de UFs |
| `src/lib/cityCoords.ts` | **EDITAR** — fallback para citiesIndex |
| `src/lib/metroRegions.ts` | **EDITAR** — adicionar RMs e aliases |
| `src/hooks/useProviders.tsx` | **EDITAR** — sliding window + UF detection |

## O que NÃO muda
- `geoScore`, `dynamicRadius`, `matchesGeoContext` (core v3 intacto)
- Pipeline de ranking (Haversine → RM → fuzzy → estado)
- Nenhuma alteração no banco de dados

## Resultado esperado
- "Região Metropolitana de Curitiba" → RM Curitiba
- "Grande BH" → Belo Horizonte
- "Encanador Campinas SP" → Campinas
- "Eletricista São José dos Pinhais" → match correto
- "Advogado RJ" → Rio de Janeiro (estado)
- Qualquer cidade brasileira → reconhecida via IBGE index

