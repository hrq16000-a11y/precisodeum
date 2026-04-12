

# UX de Localização e Engajamento — Implementação

## Funcionalidades

### 1. Estimativa de tempo de deslocamento nos cards
Converter distância em tempo estimado usando velocidade urbana (~25 km/h) no `ProviderCard`.
- **Arquivo**: `src/components/ProviderCard.tsx`
- Onde hoje mostra "📍 2.5 km", adicionar "~6 min"
- Fórmula: `Math.ceil(distanceKm / 25 * 60)` minutos (velocidade média urbana)

### 2. Badge "Super Perto!" (< 2km)
- **Arquivo**: `src/components/ProviderCard.tsx`
- Quando `distanceKm < 2`, exibir badge pulsante "Super Perto!" com gradiente sutil
- Usar `motion.span` com animação de pulse

### 3. Tag "Atendimento Rápido na Vizinhança" (< 5km)
- **Arquivo**: `src/components/ProviderCard.tsx`
- Quando `distanceKm < 5`, exibir tag "Atendimento Rápido" com ícone de raio

### 4. Smart Cache de Localização (já existe parcialmente)
- **Arquivo**: `src/hooks/useGeoCity.ts`
- O localStorage já salva lat/lng/city/state com TTL de 2h
- **Melhoria**: ao inicializar, se há dados em cache válidos (< 2h), pular o pedido de GPS e usar os dados cacheados imediatamente; só pedir GPS em background para atualizar silenciosamente

### 5. Busca por "Caminho do Trabalho"
- **Novo arquivo**: `src/components/RouteSearchModal.tsx`
  - Modal com dois inputs de endereço (Casa e Trabalho)
  - Geocodificação via Nominatim (gratuito, OpenStreetMap)
  - Calcula corredor retangular entre os dois pontos (bounding box expandida ~3km)
  - Filtra profissionais cujas coordenadas estão dentro do corredor
  - Exibe resultados ordenados por distância ao ponto médio
- **Arquivo**: `src/pages/SearchPage.tsx`
  - Adicionar botão "Buscar no caminho Casa→Trabalho" nos filtros
  - Quando ativado, substituir o filtro de cidade pela lógica de corredor

### 6. Filtro visual de proximidade na SearchPage
- **Arquivo**: `src/pages/SearchPage.tsx`
  - Adicionar opção de sort "Mais Perto" explícita no dropdown (alias de 'relevance' quando tem GPS)

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/components/ProviderCard.tsx` | Badge "Super Perto!", tag "Atendimento Rápido", estimativa de tempo |
| `src/hooks/useGeoCity.ts` | Smart cache: não pedir GPS se cache < 2h válido |
| `src/components/RouteSearchModal.tsx` | **Criar** — modal Casa→Trabalho com Nominatim |
| `src/pages/SearchPage.tsx` | Botão de rota + sort "Mais Perto" |

## Detalhes técnicos
- Nominatim (gratuito, sem API key): `https://nominatim.openstreetmap.org/search?q=...&format=json`
- Corredor Casa→Trabalho: bounding box entre os dois pontos expandida 3km em cada direção, filtragem client-side
- Estimativa de tempo: `Math.ceil(distKm * 60 / 25)` min (25km/h média urbana), com mínimo "< 5 min" para < 2km
- Zero dependências externas novas

