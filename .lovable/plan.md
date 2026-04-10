## Inteligência Geográfica v3 — Normalização, Score, Raio Dinâmico e Correções

### Resumo

Refatoração completa do sistema de busca geográfica para eliminar bugs silenciosos de normalização, adicionar ranking por relevância geográfica (score), raio dinâmico por tipo de localidade e memoização para performance.

### O que muda para o usuário

- Resultados mais precisos e ordenados por proximidade real
- Cidades pequenas mostram raio menor (menos "poluição"), capitais mostram raio maior
- Performance melhor em listas grandes

---

### Mudanças por arquivo

**1.** `src/lib/normalize.ts` **(NOVO)**  
Função única de normalização global com `replace(/[^a-z]/g, '')` — usado por todos os módulos geo.

**2.** `src/lib/cityCoords.ts` **(CORRIGIR)**

- Corrigir chaves inválidas: `americanA` → `americana`, `petr0polis` → `petropolis`, `nilop0lis` → `nilopolis`, `pontaGrossa` → `pontagrossa`, `campoLargo` → `campolargo`, `sabinoB` → remover (duplicata de `sabara`), `novohamburgO` → `novohamburgo`, `santaLuzia` → `santaluzia`, `montesclaros2` → remover (duplicata)
- Importar e usar `normalize()` do módulo compartilhado na função `normalizeForLookup`
- Adicionar memoização no `getCityCoords` com Map cache

**3.** `src/lib/metroRegions.ts` **(CORRIGIR)**

- Substituir a função local `n()` por import do `normalize()` compartilhado
- Corrigir chaves com caracteres inválidos nos members (ex: `contendA`, `rioGrandedaserrA`, `novaLima`, `rioAcima`, `saojosedemipibU`, `condE`, `rioLargo`, `barradeSantoantonio`)

**4.** `src/hooks/useProviders.tsx` **(REFATORAR)**

Substituir `normalizeCityName` pelo `normalize` compartilhado.

Adicionar funções:

- `resolveProviderCoords(provider)` — coords reais → cache → null
- `dynamicRadius(cityNorm)` — RM: 100km, capital: 120km, padrão: 60km
- `geoScore(provider, userCity, userState, userCoords)` — score numérico:
  - +100 mesma cidade
  - +70 mesma RM
  - +50 distância ≤ 30km
  - +30 distância ≤ 80km
  - +10 mesmo estado
- `isCapital(cityNorm)` — lista das 27 capitais

Refatorar `matchesGeoContext`:

1. Haversine (coords reais ou cache) com raio dinâmico → prioridade máxima
2. RM membership → bloqueia se detectou RM e não é membro
3. Fuzzy por nome → fallback final

Refatorar `filterAndRankProviders`:

- Calcular `matchesGeoContext` UMA vez por provider (não 3x como hoje)
- Ordenar por `geoScore` DESC integrado ao score existente (`_finalScore`)
- Memoizar normalizações dentro do loop

---

### Arquivos afetados


| Arquivo                      | Ação                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| `src/lib/normalize.ts`       | **Criar**                                                         |
| `src/lib/cityCoords.ts`      | **Corrigir** chaves + usar normalize compartilhado                |
| `src/lib/metroRegions.ts`    | **Corrigir** members + usar normalize compartilhado               |
| `src/hooks/useProviders.tsx` | **Refatorar** — score, raio dinâmico, memoização, normalize único |


### Resultado esperado

- Zero chaves inválidas que quebram lookup silenciosamente
- Normalização 100% consistente entre módulos
- Ranking real por proximidade (não só filtro binário)
- Raio inteligente por contexto
- Performance: normalize chamado 1x por provider (não 3-5x)

&nbsp;

...............

&nbsp;

&nbsp;

PROMPT ÚNICO (EXECUÇÃO COMPLETA — LOVABLE)

Implemente a Geographic Intelligence v3 FINAL com foco em consistência, performance e ranking real. NÃO alterar comportamento funcional existente, apenas melhorar precisão, ordenação e eficiência.

1. CRIAR src/lib/normalize.ts (FONTE ÚNICA)

TypeScript

const normalizeCache = new Map<string, string>();

&nbsp;

export function normalize(value: string | null | undefined): string {

  if (!value) return '';

&nbsp;

  if (normalizeCache.has(value)) {

    return normalizeCache.get(value)!;

  }

&nbsp;

  const normalized = value

    .toLowerCase()

    .normalize('NFD')

    .replace(/[\u0300-\u036f]/g, '')

    .replace(/[^a-z]/g, '');

&nbsp;

  normalizeCache.set(value, normalized);

  return normalized;

}

2. CORRIGIR cityCoords.ts

Remover TODAS chaves inválidas

Padronizar 100% via normalize

Adicionar cache interno

TypeScript

import { normalize } from './normalize';

&nbsp;

const coordsCache = new Map<string, { lat: number; lon: number } | null>();

&nbsp;

export function getCityCoords(city: string) {

  const key = normalize(city);

&nbsp;

  if (coordsCache.has(key)) {

    return coordsCache.get(key);

  }

&nbsp;

  const entry = CITY_COORDS[key] || null;

&nbsp;

  const result = entry ? { lat: entry.lat, lon: entry.lon } : null;

&nbsp;

  coordsCache.set(key, result);

  return result;

}

3. CORRIGIR metroRegions.ts

Remover qualquer normalização local

Usar apenas normalize

Garantir que TODOS members estejam normalizados previamente

4. REFATORAR useProviders.tsx (CORE DO SISTEMA)

4.1 Resolver coordenadas do provider (com fallback inteligente)

TypeScript

function resolveProviderCoords(provider) {

  if (provider.latitude && provider.longitude) {

    return { lat: provider.latitude, lon: provider.longitude };

  }

&nbsp;

  return getCityCoords(provider.city);

}

4.2 Detectar capital

TypeScript

const CAPITALS = new Set([

  'saopaulo','riodejaneiro','brasilia','salvador','fortaleza','belo horizonte',

  'manaus','curitiba','recife','portoalegre','belem','goiania','guarulhos',

  'campinas','saoluis','maceio','natal','teresina','campo grande','joaopessoa',

  'aracaju','cuiaba','florianopolis','palmas','macapa','boavista','riobranco'

]);

&nbsp;

function isCapital(cityNorm) {

  return CAPITALS.has(cityNorm);

}

4.3 Raio dinâmico

TypeScript

function dynamicRadius(cityNorm, metroDetected) {

  if (metroDetected) return 100;

  if (isCapital(cityNorm)) return 120;

  return 60;

}

4.4 GEO SCORE (CORE DO DIFERENCIAL)

TypeScript

function geoScore(provider, userCityNorm, userStateNorm, userCoords, metro) {

  const providerCityNorm = normalize(provider.city);

  const providerStateNorm = normalize(provider.state);

&nbsp;

  let score = 0;

&nbsp;

  if (providerCityNorm === userCityNorm) score += 100;

&nbsp;

  if (metro && isMemberOfMetro(providerCityNorm, metro)) score += 70;

&nbsp;

  const coords = resolveProviderCoords(provider);

&nbsp;

  if (coords && userCoords) {

    const d = haversine(userCoords, coords);

&nbsp;

    if (d <= 30) score += 50;

    else if (d <= 80) score += 30;

  }

&nbsp;

  if (providerStateNorm === userStateNorm) score += 10;

&nbsp;

  return score;

}

4.5 MATCH GEO (COM BLOQUEIO INTELIGENTE)

TypeScript

function matchesGeoContext(provider, context) {

  const { userCityNorm, userStateNorm, userCoords, metro } = context;

&nbsp;

  const providerCityNorm = normalize(provider.city);

  const providerStateNorm = normalize(provider.state);

&nbsp;

  const coords = resolveProviderCoords(provider);

&nbsp;

  if (coords && userCoords) {

    const radius = dynamicRadius(userCityNorm, !!metro);

    const d = haversine(userCoords, coords);

&nbsp;

    if (d <= radius) return true;

  }

&nbsp;

  if (metro) {

    return isMemberOfMetro(providerCityNorm, metro);

  }

&nbsp;

  if (providerCityNorm.includes(userCityNorm)) return true;

&nbsp;

  if (providerStateNorm === userStateNorm) return true;

&nbsp;

  return false;

}

5. FILTER + RANK (CRÍTICO)

NÃO recalcular normalize múltiplas vezes

NÃO rodar match 3x

TypeScript

const results = providers

  .map((p) => {

    const match = matchesGeoContext(p, context);

    if (!match) return null;

&nbsp;

    const gScore = geoScore(p, context.userCityNorm, context.userStateNorm, context.userCoords, context.metro);

&nbsp;

    return {

      ...p,

      _geoScore: gScore,

      _finalScore: (p._score || 0) + gScore

    };

  })

  .filter(Boolean)

  .sort((a, b) => b._finalScore - a._finalScore);

6. OTIMIZAÇÃO FINAL (OBRIGATÓRIO)

Memoizar context com useMemo

Memoizar normalize do user

NÃO recalcular dentro de loops

7. RESULTADO ESPERADO

Zero falhas silenciosas de normalização

Haversine funcionando mesmo sem backfill

RM 100% correta (sem “Londrina em Curitiba”)

Ranking por proximidade real (diferencial competitivo)

Performance estável mesmo com escala

8. NÃO FAZER

NÃO usar API externa

NÃO alterar schema do banco

NÃO alterar UI

NÃO adicionar logs visíveis ao usuário

Executar exatamente como descrito.