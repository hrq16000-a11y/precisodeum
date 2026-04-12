

# Busca Profunda: Incluir Serviços no Matching de Texto

## Problema
A busca textual filtra apenas campos do provider (`name`, `category`, `description`, `businessName`). Os dados dos **serviços cadastrados** (`service_name`, `description`, `service_area`) são carregados pelo fetch mas **ignorados no matching** — um profissional com serviço "Manutenção de Eletrônicos" não aparece ao buscar "técnico eletrônica".

## Solução
Incluir os textos dos serviços no campo `searchable` usado pelo filtro textual, sem alterar a estrutura de dados existente.

## Alterações

### `src/hooks/useProviders.tsx`

**1. Enriquecer `DbProvider` com campo de busca agregado**

Na função `fetchProvidersLightweight` (linha ~232), ao mapear os providers, concatenar os nomes e descrições de todos os serviços do profissional num campo `_searchableServices`:

```typescript
// Após o mapProvider, agregar textos dos serviços para busca
const allServices = (serviceRows as any[]).filter(s => s.provider_id === p.id);
const svcTexts = allServices.map(s => 
  [s.service_name || '', s.description || '', s.service_area || ''].join(' ')
).join(' ');
(mapped as any)._searchableServices = svcTexts;
```

**2. Incluir `_searchableServices` no filtro textual**

Nas duas funções `filterAndRankProviders` (linha ~430) e `filterAndRankProvidersGrouped` (linha ~529), adicionar o campo `_searchableServices` ao texto pesquisável:

```typescript
// ANTES:
const searchable = [p.name, p.category, p.description, p.businessName || '', p.city, p.neighborhood, p.state]
  .join(' ').toLowerCase()...

// DEPOIS:
const searchable = [p.name, p.category, p.description, p.businessName || '', p.city, p.neighborhood, p.state, (p as any)._searchableServices || '']
  .join(' ').toLowerCase()...
```

**3. Incluir na relevância do SIL** (`src/lib/searchIntelligence.ts`)

Na função `computeRelevanceScore` (linha ~253), o campo `searchable` já recebe `provider.description`. Não precisa mudar o SIL — o matching principal é no `useProviders`.

## Impacto
- **Zero alterações no banco de dados** — os serviços já são carregados
- **Zero custo extra de query** — os dados já estão no fetch existente
- **1 arquivo alterado**: `src/hooks/useProviders.tsx`
- Buscar "técnico eletrônica" agora encontra profissionais cujos serviços mencionam "eletrônica", mesmo que o perfil não mencione

## Detalhes técnicos
- Os tokens sanitizados (`["tecnico", "eletronica"]`) serão comparados contra o texto concatenado de todos os serviços
- O threshold de matching (1 token = 100%, 2+ tokens = 50%) continua o mesmo
- A normalização NFD + remoção de acentos já é aplicada no `searchable`, garantindo que "Eletrônicos" casa com "eletronica"

