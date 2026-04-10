## Problema identificado

A busca por **"Região Metropolitana de Curitiba"** retorna apenas **1 resultado** porque:

1. O texto `q=Região Metropolitana de Curitiba` é tratado como **busca textual** — filtra providers cujo nome/descrição/cidade contém TODOS os termos ("região", "metropolitana", "de", "curitiba")
2. A inteligência geográfica (metro region detection) só é ativada pelo parâmetro `city` (via `effectiveCity`), **não pelo** `q`
3. O chip de geolocalização mostra "Boardman, Oregon" (IP do servidor sandbox), então a geo context não ajuda

## Solução

Detectar termos geográficos dentro do `q` (query) e extrair automaticamente para o contexto geo, em vez de tratá-los como filtro textual.

### Alterações

**1.** `src/hooks/useProviders.tsx` **—** `filterAndRankProviders` (função principal)

Antes de aplicar o filtro textual, detectar se o `query` contém um padrão geo reconhecível ("região metropolitana de X", "grande X", etc.):

- Usar `resolveMetroRegion(normalize(query))` para verificar se o query inteiro resolve para uma metro region
- Se sim: usar o metro region como contexto geo (ignorando o `city` parameter) e **remover os termos geo do query textual**
- Se o query normalizado corresponde a uma cidade conhecida (via `getCityCoords`), também tratá-lo como filtro geo em vez de texto

**2.** `src/pages/SearchPage.tsx` — Ajuste mínimo

Passar o `query` raw para `useSearchProviders` como já faz. Nenhuma alteração necessária aqui — toda a inteligência fica no hook.

### Lógica de detecção (pseudocódigo)

```text
queryNorm = normalize(query)

1. Tentar resolveMetroRegion(queryNorm) → se encontrar metro:
   - Usar metro como geo context
   - Usar coordenadas do polo como userCoords
   - Limpar query textual (não filtrar por "região metropolitana de curitiba")

2. Senão, tentar getCityCoords(queryNorm) → se encontrar cidade:
   - Usar como city no geo context
   - Manter o restante do query como texto

3. Senão: comportamento atual (busca textual pura)
```

### Resultado esperado

- `q=Região Metropolitana de Curitiba` → ~98 providers da RM Curitiba
- `q=Curitiba` → providers de Curitiba + RM, ordenados por Haversine
- `q=encanador Curitiba` → encanadores na RM Curitiba
- `q=encanador` → sem filtro geo (comportamento atual mantido)

SIM.

&nbsp;

Plano de implementação (correto e sem quebrar GEO v3):

&nbsp;

1. Interceptar query no início do filterAndRankProviders

&nbsp;

queryNorm = normalize(query)

&nbsp;

&nbsp;

&nbsp;

2. Detecção de Região Metropolitana

&nbsp;

const metro = resolveMetroRegion(queryNorm);

if (metro) {

  ctx.metro = metro;

  ctx.cityNorm = metro.pole;

  ctx.coreCity = metro.pole;

  ctx.userCoords = getCityCoords(metro.pole);

  query = ''; // limpa filtro textual

}

&nbsp;

&nbsp;

3. Detecção de cidade direta

&nbsp;

else if (getCityCoords(queryNorm)) {

  ctx.cityNorm = queryNorm;

  ctx.coreCity = queryNorm;

  ctx.userCoords = getCityCoords(queryNorm);

  query = ''; // evita filtrar texto

}

&nbsp;

&nbsp;

4. Query mista (serviço + cidade)

&nbsp;

Detectar cidade dentro da string:

&nbsp;

&nbsp;

const tokens = queryNorm.split(/\s+/);

const cityToken = tokens.find(t => getCityCoords(t));

if (cityToken) {

  ctx.cityNorm = cityToken;

  ctx.coreCity = cityToken;

  ctx.userCoords = getCityCoords(cityToken);

  query = query.replace(new RegExp(cityToken, 'i'), '').trim();

}

&nbsp;

&nbsp;

5. Manter pipeline existente

&nbsp;

GEO continua:

&nbsp;

Haversine → RM → fuzzy → estado

&nbsp;

&nbsp;

Text search só com termos não-geo

&nbsp;

&nbsp;

&nbsp;

6. Regra crítica

&nbsp;

Geo detection SEMPRE antes do filtro textual

&nbsp;

Nunca misturar RM com filtro textual completo

&nbsp;

&nbsp;

&nbsp;

7. Resultado esperado

&nbsp;

“Região Metropolitana de Curitiba” → RM completa

&nbsp;

“Curitiba” → cidade + RM

&nbsp;

“encanador Curitiba” → serviço + geo correto

&nbsp;

“encanador” → comportamento atual

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Conclusão:

✔ Corrige o problema sem tocar no core

✔ Mantém determinismo

✔ Eleva UX e SEO imediatamente