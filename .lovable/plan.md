

## Parte 2: Cidade Inteligente no Cadastro

### O que muda
Substituir os campos de texto livre "Cidade" e "Estado" por um seletor inteligente com:

1. **Botão "Usar minha localização"** — GPS do navegador + reverse geocode para auto-preencher cidade/estado
2. **Busca em tempo real** — Input com autocomplete consultando os 5.570 municípios brasileiros (API IBGE, com cache)
3. **Estado auto-preenchido** — Ao selecionar uma cidade, o estado é preenchido automaticamente (readonly)
4. **Coordenadas salvas** — Geocodifica via Nominatim para salvar lat/lon no provider

### Implementação

**Arquivo: `src/pages/SignupPage.tsx`**

- Importar e reutilizar `fetchAllMunicipalities()` e `geocodeCity()` do `GeoLocationChip.tsx` (extrair para módulo compartilhado `src/lib/geoUtils.ts`)
- Criar novo módulo `src/lib/geoUtils.ts` com as funções `fetchAllMunicipalities`, `geocodeCity` e `normalize` extraídas do GeoLocationChip
- Substituir os 2 inputs (cidade + estado) por:
  - Botão "📍 Usar minha localização" (chama `navigator.geolocation` + reverse geocode)
  - Input com busca fuzzy nos municípios + dropdown de sugestões
  - Campo Estado readonly (auto-preenchido)
- Adicionar `latitude` e `longitude` ao form state
- No `handleSubmit`, salvar lat/lon no insert do provider

**Arquivo: `src/components/GeoLocationChip.tsx`**
- Importar funções de `src/lib/geoUtils.ts` em vez de defini-las localmente

### Arquivos afetados
1. **Criar** `src/lib/geoUtils.ts` — funções compartilhadas
2. **Editar** `src/pages/SignupPage.tsx` — novo seletor de cidade
3. **Editar** `src/components/GeoLocationChip.tsx` — importar de geoUtils

