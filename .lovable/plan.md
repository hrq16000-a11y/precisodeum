

# Separar Resultados por Proximidade: Mesmo Estado vs Outro Estado

## Problema
Atualmente, quando não há resultados locais, todos os profissionais aparecem numa lista única. Profissionais de Curitiba (15km) ficam misturados com profissionais de Recife (2468km) sem distinção visual. O mesmo ocorre na seção "Outras regiões".

## Solução
Dividir os resultados em **3 grupos visuais**:

```text
┌─────────────────────────────────┐
│ 📍 Na sua região (até Xkm)     │  ← resultados locais (já existe)
│   Provider A - 3km              │
│   Provider B - 8km              │
├─────────────────────────────────┤
│ 🏙️ Cidades próximas            │  ← mesmo estado OU distância < 100km
│   Provider C - Curitiba, 15km   │
│   Provider D - Paranaguá, 80km  │
├─────────────────────────────────┤
│ 🌍 Outro Estado (3)            │  ← colapsado por padrão
│   [Deseja ver? Ver mais...]     │
│   Provider E - Recife, 2468km   │  ← só aparece ao clicar
└─────────────────────────────────┘
```

## Alterações

### 1. `src/hooks/useProviders.tsx` — Retornar 3 grupos
Na função `filterAndRankProvidersGrouped`, separar `otherArr` em dois sub-arrays:
- `nearby`: mesmo `state_uf` OU `distanceKm < 100`
- `outOfState`: estado diferente E `distanceKm >= 100`

Retornar `{ local, nearby, outOfState, isFallback }` em vez de `{ local, other }`.

No fallback (0 locais): separar o array combinado em `nearby` (mesmo estado / < 100km) e `outOfState`.

### 2. `src/pages/SearchPage.tsx` — Renderizar 3 seções
- Seção "Cidades próximas" com label e grid (visível automaticamente)
- Seção "Outro Estado" com botão colapsável: "Profissionais de outro estado (X). Deseja ver?" → expande ao clicar
- Estado `showOutOfState` para controlar visibilidade

### 3. `src/pages/CategoryPage.tsx` — Mesma lógica de 3 grupos
- Separar `other` em `nearby` e `outOfState`
- No fallback, separar `allSorted` em dois grupos
- Botão colapsável para "Outro Estado"

## Arquivos alterados

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useProviders.tsx` | Retornar `nearby` + `outOfState` em vez de `other` |
| `src/pages/SearchPage.tsx` | 3 seções visuais; "Outro Estado" colapsado |
| `src/pages/CategoryPage.tsx` | Mesma separação nearby/outOfState com botão colapsável |

## Resultado
- Curitiba (mesmo estado, 15km) aparece automaticamente como "cidade próxima"
- Recife (outro estado, 2468km) fica escondida atrás de "Outro Estado. Deseja ver?"
- Funciona nacionalmente em qualquer combinação de cidade/estado

