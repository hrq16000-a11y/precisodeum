

# RPC de Proximidade com PostGIS + Bairro

## Situação Atual

- **PostGIS ativo** com coluna `geog` + índice GiST na tabela `providers` ✓
- **Tabela `neighborhoods`** existe mas está **vazia** (0 registros) e **não tem coluna de polígono** (só id, city_id, name, slug)
- Profissionais já têm campo `neighborhood` (texto) preenchido manualmente

## Problema com "tabela de polígonos"

Não existe dados de polígonos de bairros no banco. Criar isso do zero exigiria importar shapefiles do IBGE (~300k setores censitários) ou de fontes como OpenStreetMap — um trabalho pesado e separado.

## Solução Prática (2 partes)

### Parte 1: RPC `nearby_providers` — implementar agora

Função que recebe coordenadas do usuário e retorna profissionais ordenados por distância, incluindo o bairro do profissional (campo texto existente):

```sql
CREATE FUNCTION public.nearby_providers(
  _lat double precision,
  _lng double precision,
  _radius_m integer DEFAULT 50000,  -- 50km padrão
  _category_slug text DEFAULT NULL,
  _limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid, slug text, business_name text,
  category_name text, category_slug text, category_icon text,
  city text, state text, neighborhood text,
  latitude numeric, longitude numeric,
  distance_m double precision,
  rating_avg numeric, review_count integer,
  photo_url text, plan text, featured boolean
)
```

- Usa `ST_DWithin(geog, point, _radius_m)` para filtro rápido pelo índice GiST
- Usa `ST_Distance(geog, point)` para distância exata em metros
- Filtra por categoria opcional
- Ordena por distância

### Parte 2: Preparar `neighborhoods` para polígonos futuros

Adicionar coluna `geom geometry(MultiPolygon, 4326)` + índice GiST na tabela `neighborhoods`, deixando pronta para importação futura de shapefiles. Criar também uma função auxiliar `get_neighborhood_by_point` que faz `ST_Contains` quando houver dados.

### Parte 3: Integrar no frontend (SeoPage + SearchPage)

Chamar `supabase.rpc('nearby_providers', { _lat, _lng })` em vez de trazer todos os providers e calcular Haversine no client.

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| Nova migration | RPC `nearby_providers`, coluna `geom` em `neighborhoods`, função `get_neighborhood_by_point` |
| `src/pages/SeoPage.tsx` | Usar RPC quando coordenadas disponíveis |
| `src/pages/SearchPage.tsx` | Usar RPC para sort "Mais Perto" |

## Impacto
- Busca por proximidade passa de O(n) client-side para O(log n) server-side com índice espacial
- Bairro do profissional já aparece (campo texto existente)
- Infraestrutura de polígonos fica pronta para importação futura

