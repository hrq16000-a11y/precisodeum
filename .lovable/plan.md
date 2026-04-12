

# Ordenar Resultados por Proximidade Geográfica Nacional

## Problema
Quando não há resultados locais (ex: São José dos Pinhais), os profissionais de "outras regiões" aparecem ordenados por nota/score, não por distância. Resultado: Recife aparece antes de Curitiba (15km), o que não faz sentido.

## Solução
Ordenar **sempre por distância real** (Haversine) quando o usuário tem coordenadas GPS, em dois locais:

### 1. `src/hooks/useProviders.tsx` — `filterAndRankProvidersGrouped` (SearchPage)

**Linha 594-601** — Alterar sort do `otherArr` para priorizar distância:
```typescript
otherArr.sort((a, b) => {
  // Distance first when available
  if (a.distanceKm !== Infinity && b.distanceKm !== Infinity) {
    const distDiff = a.distanceKm - b.distanceKm;
    if (Math.abs(distDiff) > 1) return distDiff;
  }
  // No coords → push to end
  if (a.distanceKm === Infinity && b.distanceKm !== Infinity) return 1;
  if (b.distanceKm === Infinity && a.distanceKm !== Infinity) return -1;
  return b.p.rating - a.p.rating;
});
```

**Linha 608** — No fallback (0 locais), também ordenar o array combinado por distância antes de retornar.

### 2. `src/pages/CategoryPage.tsx` — Separação local/other

**Linha 69-96** — Enriquecer `other` com distância e ordenar por proximidade:
- Calcular `distanceKm` para cada provider no array `other` (não só os locais)
- Ordenar `other` por distância crescente
- No fallback (linha 96), ordenar `allProviders` por distância antes de retornar

## Arquivos alterados

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useProviders.tsx` | `otherArr.sort` prioriza distância; fallback também ordena por distância |
| `src/pages/CategoryPage.tsx` | `other` array recebe distância e é ordenado por proximidade; fallback ordena por distância |

## Resultado
- Curitiba (15km) sempre aparece antes de Recife (2500km)
- Funciona nacionalmente para qualquer cidade
- Quando GPS não disponível, mantém ordenação por rating como fallback

