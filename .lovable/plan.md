
# Correção completa da busca geográfica

## Diagnóstico real do problema

A falha não está só no layout. Hoje existem 4 causas técnicas:

1. **GeoEngine está permissivo demais**  
   Em `src/lib/geoEngine.ts`, `matchesGeoContext()` considera prestador “local” só por ser do **mesmo estado**, mesmo estando fora do raio. Isso quebra a prioridade por distância e mistura cidades distantes.

2. **A UI ainda mistura os grupos**  
   Em `src/pages/SearchPage.tsx`, quando expande “outras localidades”, a página concatena `local + other` no mesmo grid antes do separador. Ou seja: visualmente continua misturado.  
   O mesmo padrão existe em `src/pages/CategoryPage.tsx`.

3. **A localização do chip não é a fonte única da busca**  
   A busca usa `selectedCity / cityParam / geoCity` ao mesmo tempo. Então o usuário troca a localização no `GeoLocationChip`, mas a `SearchPage` pode continuar usando a cidade antiga da URL.

4. **Há dados públicos de localização inconsistentes**  
   Hoje há prestadores aprovados sem cidade/UF/coordenadas e ao menos um com UF salva como nome completo. Mesmo com código melhor, isso degrada o resultado.

---

## O que vou corrigir

### 1. Tornar o raio um critério real
Em `src/lib/geoEngine.ts` e `src/hooks/useProviders.tsx`:

- Se houver coordenadas do usuário/cidade selecionada:
  - **local = dentro do raio**
  - **fora do raio = outras regiões**
- Cidade/metro/UF passam a ser **fallback**, não critério que ignora o km
- Mesmo prestador na mesma cidade, mas fora do raio escolhido, não ficará mais no bloco local
- Vou expor também o `distanceKm` calculado para ordenar e exibir confiança no ranking

### 2. Reescrever o agrupamento da busca
Em `src/hooks/useProviders.tsx`:

- Substituir o agrupamento atual por buckets claros:
  - `local`
  - `other`
  - `isFallback`
- Ordenação do bloco local:
  1. menor distância real
  2. geoScore
  3. relevância textual
  4. score interno existente
- Prestadores sem coordenadas nunca entram como “prioridade por proximidade”; ficam em fallback controlado

### 3. Separar visualmente local vs outras regiões de verdade
Em `src/pages/SearchPage.tsx`:

- Renderizar **dois blocos independentes**
  - “Na sua região / até X km”
  - “Outras localidades”
- Remover a lista única concatenada
- O botão “Ver outras localidades” abrirá apenas o segundo bloco
- Paginação passará a respeitar a separação para não reembaralhar os grupos

### 4. Aplicar a mesma lógica na página de categoria
Em `src/pages/CategoryPage.tsx`:

- Reusar a mesma classificação geográfica
- Não misturar mais resultados locais com nacionais
- Exibir fallback nacional só quando realmente não houver resultado dentro do raio

### 5. Corrigir a origem da localização
Em `src/hooks/useGeoCity.ts`, `src/components/GeoLocationChip.tsx`, `src/components/SearchBar.tsx` e `src/lib/geoUtils.ts`:

- Normalizar UF sempre para sigla (`PR`, `SP`, etc.)
- Garantir que mudança no chip atualize a busca ativa
- Fazer a `SearchPage` usar a localização atual do contexto como fonte principal, não uma cidade velha presa na URL

### 6. Limpeza mínima de dados para a busca ficar confiável
No backend:

- corrigir prestadores aprovados com `city/state` vazios
- normalizar estados salvos por extenso para UF
- preencher coordenadas ausentes com backfill
- impedir que prestadores sem localização válida entrem no bloco “local”

---

## Arquivos que serão ajustados

| Arquivo | Ação |
|---|---|
| `src/lib/geoEngine.ts` | endurecer regra geográfica e raio |
| `src/hooks/useProviders.tsx` | novo agrupamento/ranking por distância |
| `src/pages/SearchPage.tsx` | separar blocos local/outras regiões corretamente |
| `src/pages/CategoryPage.tsx` | aplicar mesma lógica da busca |
| `src/hooks/useGeoCity.ts` | sincronizar localização atual e raio |
| `src/components/GeoLocationChip.tsx` | manter chip como fonte real da localização |
| `src/components/SearchBar.tsx` | alinhar cidade/UF enviados para a busca |
| `src/lib/geoUtils.ts` | normalização de UF/reverse geocode |
| Migração/backfill | saneamento dos dados públicos de localização |

## Resultado esperado

Depois dessa correção:

- o km escolhido passa a funcionar de verdade
- resultados próximos ficam primeiro
- resultados fora do raio ficam separados
- não haverá mais mistura visual entre local e nacional
- trocar localização no chip afetará imediatamente a busca
- a base ficará consistente para buscas globais com mais precisão
