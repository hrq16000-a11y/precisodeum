

## Inteligência Geográfica Universal para Todo o Brasil

### Problema Raiz
A lógica atual de `matchesGeoContext` tem 3 falhas críticas:

1. **Sem coordenadas nos providers** — o cálculo Haversine nunca é usado, então o fallback por texto é o único caminho
2. **Fallback "região metropolitana → estado" é grosseiro** — "Região Metropolitana de Curitiba" retorna providers de Londrina (400km), fazendo o sistema parecer quebrado
3. **Apenas "Região Metropolitana de X" é tratada** — padrões como "Grande São Paulo", "Baixada Fluminense", "Região do ABC" não são reconhecidos

### Solução em 3 camadas

**Camada 1 — Geocodificação sob demanda dos providers (sem coordenadas)**
Quando o user TEM coordenadas mas o provider NÃO tem, geocodificar o provider em tempo real usando a cidade/estado dele contra um mapa de coordenadas de municípios (cache estático). Isso permite que o Haversine funcione imediatamente sem depender do backfill.

- Criar um cache local de coordenadas dos ~200 maiores municípios brasileiros em `src/lib/cityCoords.ts`
- No `matchesGeoContext`, quando o provider não tem lat/lon, buscar no cache pela cidade normalizada
- Se encontrar, usar Haversine normalmente

**Camada 2 — Extração inteligente de padrões regionais**
Expandir `extractCoreCity` para reconhecer todos os padrões comuns de geo-detecção:

```text
Padrões reconhecidos:
- "Região Metropolitana de X" → cidade X
- "Grande X" → cidade X  
- "Baixada X" → busca por estado
- "Região do ABC" → São Paulo/SP
- "Litoral X" → busca por estado
- Qualquer variação com prefixo regional → extrai cidade-polo
```

**Camada 3 — Fallback por proximidade estimada (não por estado inteiro)**
Quando não há coordenadas de nenhum lado e a busca é por região metropolitana:

- Em vez de aceitar TODO o estado, usar uma lista fixa das ~15 maiores regiões metropolitanas do Brasil com seus municípios membros
- Se a cidade do provider está na lista de municípios da RM detectada → match
- Se não está na lista → não match (evita Londrina quando buscando RM Curitiba)

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/lib/cityCoords.ts` | **Criar** — cache de coordenadas dos ~200 maiores municípios |
| `src/lib/metroRegions.ts` | **Criar** — mapa das regiões metropolitanas com municípios membros |
| `src/hooks/useProviders.tsx` | **Editar** — `matchesGeoContext` e `extractCoreCity` com lógica de 3 camadas |

### Resultado esperado
- "Região Metropolitana de Curitiba" → mostra São José dos Pinhais, Colombo, Araucária, mas NÃO Londrina
- "Grande São Paulo" → mostra Guarulhos, Osasco, Santo André, mas NÃO Campinas
- Qualquer cidade com coordenadas do user → Haversine funciona mesmo sem backfill
- Zero dependência de APIs externas em tempo de busca — tudo local/estático

