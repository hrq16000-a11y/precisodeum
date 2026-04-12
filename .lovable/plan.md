

# Auditoria de Geolocalização: Debug Visível + Reforços

## Diagnóstico

Após análise detalhada, o sistema de geo está funcional mas tem 3 lacunas concretas:

1. **Zero logs de debug** — não há como auditar se as coordenadas e distâncias estão corretas
2. **Fallback de GPS fraco** — quando GPS é negado, o `useGeoCity` já faz fallback via IP, mas não força atualização imediata da lista (pode ficar com dados stale)
3. **Client-side sort override** — no `SearchPage.tsx` linha 94, quando `sortBy !== 'relevance'`, o `.sort()` por rating/nome **destroi** a ordenação por proximidade sem preservar a separação local/other
4. **Sem aviso de "ninguém perto"** — o `GeoFallbackBanner` existe mas só aparece quando há 0 locais; não avisa quando o mais próximo está a 50+ km

## Alterações

### 1. `src/hooks/useProviders.tsx` — Logs de debug de geolocalização

Adicionar `console.debug` na função `filterAndRankProvidersGrouped` após o cálculo de distância (linha ~560):

```typescript
if (import.meta.env.DEV) {
  console.debug(`[GeoAudit] User: ${userLat}, ${userLon} | Provider: ${p.name} (${p.latitude}, ${p.longitude}) | Dist: ${distanceKm.toFixed(1)} km | Local: ${isLocal}`);
}
```

E no início da função, logar o contexto:
```typescript
if (import.meta.env.DEV) {
  console.debug('[GeoAudit] Query:', { query, city, state, userLat, userLon, radiusKm });
}
```

### 2. `src/hooks/useGeoCity.ts` — Reforço de fallback imediato

No `requestPreciseLocation`, quando GPS é negado (callback de erro, linha ~244), forçar imediatamente o fetch via IP se ainda não tiver coordenadas:

```typescript
() => {
  // GPS denied — force IP fallback immediately
  if (geoState.latitude === null) {
    fetchStarted = false; // reset to allow re-fetch
    startFetchIfNeeded();
  }
  resolve(false);
}
```

### 3. `src/pages/SearchPage.tsx` — Strict sorting (preservar proximidade)

Linha 94-105: quando `sortBy !== 'relevance'`, aplicar o sort secundário **dentro de cada grupo** (local/other separadamente), não misturando os arrays:

```typescript
if (sortBy !== 'relevance') {
  const sortFn = (a: DbProvider, b: DbProvider) => {
    switch (sortBy) {
      case 'rating': return b.rating - a.rating;
      case 'reviews': return b.reviewCount - a.reviewCount;
      case 'name_asc': return a.name.localeCompare(b.name);
      case 'name_desc': return b.name.localeCompare(a.name);
      case 'experience': return b.yearsExperience - a.yearsExperience;
      default: return 0;
    }
  };
  results.sort(sortFn);
}
```

Alterar `applyClientFilters` para receber um parâmetro `isLocal` e, quando `sortBy === 'relevance'` e o grupo é local, **manter a ordenação original** (que já vem por distância).

### 4. `src/components/GeoFallbackBanner.tsx` — Aviso de "ninguém tão perto"

Adicionar suporte a um novo cenário: quando há resultados locais mas o mais próximo está a 50+ km. Adicionar prop `nearestDistanceKm` e exibir mensagem:

```
"O profissional mais próximo está a X km de você. Mostrando resultados da sua região."
```

### 5. `src/pages/CategoryPage.tsx` e `src/pages/SearchPage.tsx` — Passar distância mínima ao banner

Calcular `nearestDistanceKm` a partir do primeiro item da lista local e passar ao `GeoFallbackBanner` quando > 50km.

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useProviders.tsx` | Adicionar logs de debug (DEV only) |
| `src/hooks/useGeoCity.ts` | Reforçar fallback IP quando GPS negado |
| `src/pages/SearchPage.tsx` | Corrigir sort para não destruir proximidade |
| `src/components/GeoFallbackBanner.tsx` | Aviso de distância mínima alta |
| `src/pages/CategoryPage.tsx` | Passar `nearestDistanceKm` ao banner |
| `src/pages/SearchPage.tsx` | Passar `nearestDistanceKm` ao banner |

## Detalhes técnicos
- Logs apenas em `import.meta.env.DEV` — zero impacto em produção
- O fix do sort é o mais impactante: atualmente se o usuário muda para "Por avaliação", a separação local/other é perdida
- O fallback de IP já existe mas pode ficar stale se o GPS foi negado antes do fetch IP completar

