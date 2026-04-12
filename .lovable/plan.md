

# PostGIS para Coordenadas dos Profissionais

## Situação Atual
- Colunas `latitude` e `longitude` são do tipo `numeric` (não texto — já é razoável)
- PostGIS **não está habilitado** no banco
- 152 de 168 profissionais já têm coordenadas preenchidas
- Toda a lógica de distância é feita no **client-side** via Haversine em JavaScript

## O que muda com PostGIS

PostGIS permite fazer cálculos de distância **no banco de dados**, o que possibilita:
- Queries como "profissionais num raio de 30km" diretamente no SQL (muito mais rápido)
- Índices espaciais (GiST) para buscas ultra-rápidas
- Ordenação por proximidade sem trazer todos os registros para o frontend

## Plano de Implementação

### Migration 1: Habilitar PostGIS + adicionar coluna geography
```sql
-- Habilitar extensão
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- Adicionar coluna geográfica na tabela providers
ALTER TABLE public.providers 
  ADD COLUMN IF NOT EXISTS geog extensions.geography(Point, 4326);

-- Preencher geog a partir das coordenadas existentes
UPDATE public.providers 
SET geog = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::extensions.geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Índice espacial GiST para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_providers_geog ON public.providers USING GIST (geog);
```

### Migration 2: Trigger para manter geog sincronizado
```sql
CREATE OR REPLACE FUNCTION public.sync_provider_geog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::extensions.geography;
  ELSE
    NEW.geog := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_provider_geog
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.sync_provider_geog();
```

### Frontend: Nenhuma alteração obrigatória agora
- O cálculo Haversine no client continua funcionando normalmente
- A coluna `geog` fica pronta para futuras queries server-side (ex: `ST_DWithin`, `ST_Distance`)
- Quando quiser migrar a busca para o backend, basta criar uma função SQL:
  ```sql
  SELECT id, name, ST_Distance(geog, ST_MakePoint($lon, $lat)::geography) AS dist_m
  FROM providers
  WHERE ST_DWithin(geog, ST_MakePoint($lon, $lat)::geography, 50000) -- 50km
  ORDER BY dist_m;
  ```

## Impacto
- **Zero breaking changes** — as colunas `latitude`/`longitude` numeric continuam existindo
- A coluna `geog` é preenchida automaticamente via trigger
- 152 profissionais terão `geog` populado imediatamente
- Índice GiST otimiza buscas espaciais futuras

## Arquivos alterados
| Arquivo | Ação |
|---------|------|
| Nova migration | Habilitar PostGIS, criar coluna `geog`, trigger de sync |

