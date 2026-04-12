

# Reestruturação Global — Plano de Implementação

## Status Atual (O que JÁ existe)

| Recurso | Status |
|---------|--------|
| PostGIS + coluna `geog` + índice GiST | ✅ Ativo |
| RPC `nearby_providers` (ST_DWithin) | ✅ Ativo |
| Hook `useNearbyProviders` | ✅ Ativo |
| `CategoryIcon` com Lucide + fallback `CircleDot` | ✅ Ativo |
| Distância em km + estimativa tempo nos cards | ✅ Ativo |
| WhatsApp deep link com mensagem padrão | ✅ Ativo |
| Fallback IP (ipapi + ipwho) com cache localStorage | ✅ Ativo |
| Formatters centralizados (Intl APIs) | ✅ Ativo |
| Mobile-first (Drawer filtros, badges limitados) | ✅ Ativo |
| AI Concierge (linguagem natural) | ❌ Não existe |
| Modo Mapa interativo | ❌ Não existe |
| Tabela de logs de demanda (heatmap) | ❌ Não existe |
| SEO dinâmico por bairro do usuário | ⚠️ Parcial (usa campo texto, sem polygon) |

## O que será feito

### 1. AI Concierge — Busca por Linguagem Natural
Criar um mapeamento client-side de frases comuns para categorias. Sem dependência de API externa.

- **Novo arquivo**: `src/lib/naturalLanguageMap.ts` — dicionário de ~100 frases mapeadas para slugs de categorias (ex: `"cano estourou" → "encanador"`, `"tomada não funciona" → "eletricista"`, `"goteira" → "telhado"`)
- **Editar**: `src/lib/searchIntelligence.ts` — no método `analyze()`, antes de resolver intent, verificar se o query match alguma frase do dicionário e substituir pelo slug da categoria
- **Editar**: `src/components/SearchBar.tsx` — adicionar placeholder animado com exemplos de linguagem natural ("meu cano estourou", "preciso pintar a casa")

### 2. Modo Mapa Interativo (Leaflet)
Adicionar toggle "Lista / Mapa" na SearchPage usando Leaflet (gratuito, sem API key).

- **Instalar**: `leaflet` + `react-leaflet` + `@types/leaflet`
- **Novo componente**: `src/components/ProvidersMap.tsx` — mapa com pins dos profissionais, popup com nome/categoria/distância/botão WhatsApp
- **Editar**: `src/pages/SearchPage.tsx` — adicionar botão toggle "📍 Ver no Mapa" / "📋 Ver Lista", renderizar `ProvidersMap` quando ativo
- **CSS**: importar CSS do Leaflet no `index.css`

### 3. WhatsApp Smart-Link com Contexto
Já existe mensagem padrão. Melhorar para incluir categoria e localização do usuário.

- **Editar**: `src/components/ProviderCard.tsx` — construir mensagem dinâmica: `"Olá {nome}! Vi seu perfil de {categoria} no Preciso de um. Estou em {bairro/cidade} e gostaria de um orçamento."`
- Usar dados do `useGeoCity()` para preencher a localização

### 4. SEO Dinâmico por Bairro
Usar o campo `neighborhood` do provider + localização do usuário para título dinâmico.

- **Editar**: `src/pages/SeoPage.tsx` — quando `useGeoCity` retorna coordenadas, incluir bairro no título da página via `useSeoHead`
- **Editar**: `src/pages/SearchPage.tsx` — mesmo ajuste no `seoTitle`

### 5. Tabela de Logs de Demanda (Heatmap futuro)
Registrar silenciosamente coordenadas de cada busca.

- **Nova migration**: criar tabela `search_demand_logs` com colunas `id`, `latitude`, `longitude`, `query`, `category_slug`, `city`, `created_at` + índice GiST na coluna `geog`
- **Trigger**: auto-popular `geog` a partir de lat/lng (mesmo padrão dos providers)
- **RLS**: insert para `anon` e `authenticated`, select apenas para admins
- **Editar**: `src/hooks/useProviders.tsx` — após cada busca, chamar `supabase.from('search_demand_logs').insert(...)` com as coordenadas do usuário (fire-and-forget, sem bloquear UI)

### 6. Correções de UI/Acessibilidade (auditoria)
- **Verificar**: que `CategoryIcon` está sendo usado em todos os lugares onde `categoryIcon` aparece (já está em 13 arquivos)
- **Editar**: `src/components/ProviderCard.tsx` — o `AvatarFallback` usa `provider.categoryIcon` como emoji string — substituir por `<CategoryIcon icon={provider.categoryIcon} />`
- **Responsividade**: confirmar `white-space: normal` e `overflow-wrap: break-word` no CSS global (já existe no `index.css` conforme memória)

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/lib/naturalLanguageMap.ts` | **Criar** — dicionário frases → categorias |
| `src/lib/searchIntelligence.ts` | Integrar NLP map no `analyze()` |
| `src/components/SearchBar.tsx` | Placeholders de linguagem natural |
| `src/components/ProvidersMap.tsx` | **Criar** — mapa Leaflet com pins |
| `src/pages/SearchPage.tsx` | Toggle Lista/Mapa + SEO bairro |
| `src/components/ProviderCard.tsx` | WhatsApp smart-link + CategoryIcon no fallback |
| `src/pages/SeoPage.tsx` | SEO título com bairro |
| Nova migration | Tabela `search_demand_logs` + GiST |
| `src/hooks/useProviders.tsx` | Log de demanda fire-and-forget |
| `src/index.css` | Import CSS Leaflet |

## Impacto
- Busca natural converte frases do dia-a-dia em categorias (sem AI API, client-side puro)
- Mapa interativo como diferencial competitivo (Leaflet gratuito)
- WhatsApp com contexto aumenta conversão
- Logs de demanda permitem futuro heatmap de oportunidades de negócio
- Zero breaking changes nas funcionalidades existentes

