# Localização do Provider — sem migração necessária

> **Status (2026-05-02):** as colunas usadas pelo fluxo "GPS preciso vs aproximado" e "origem do bairro" **já existem** na tabela `providers`. Nenhuma migração de banco é exigida pela feature de telemetria de localização do wizard.

## Colunas envolvidas

| Coluna                  | Tipo            | Origem do dado                                     | Pode ser NULL? |
|-------------------------|-----------------|----------------------------------------------------|----------------|
| `geo_source`            | text            | `'gps' \| 'cep' \| 'ip' \| 'manual'`               | sim            |
| `geo_source_confidence` | numeric / float | precisão GPS em metros (`accuracy_m`)              | sim            |
| `neighborhood_source`   | text            | `'user' \| 'gps' \| 'cep' \| 'ip' \| 'default_centro'` | sim        |
| `neighborhood`          | text            | bairro digitado/sugerido                           | default `'Centro'` (trigger `trg_fill_provider_neighborhood_default`) |
| `latitude` / `longitude`| double precision| GPS ou geocoding via CEP                           | sim            |

Todas essas colunas já estavam no schema antes desta feature — o wizard apenas passou a **escrevê-las** com valores corretos. Providers cadastrados antes do release continuam válidos com **NULL** nesses campos: a UI trata o NULL como "informação ausente" e não quebra.

## Fallback no front-end

O componente `ProfileLocationChecklist` (em `src/components/dashboard/`) já lida com providers legados:

```ts
const hasUserNeighborhood = !!(
  provider.neighborhood &&
  provider.neighborhood.trim().length > 0 &&
  provider.neighborhood_source === 'user'   // NULL ⇒ false ⇒ item pendente
);

const hasCoords =
  typeof provider.latitude === 'number' &&
  typeof provider.longitude === 'number';   // NULL ⇒ item pendente

// Mensagem condicional do GPS — só roda se houver número, evita NaN
hint: hasCoords && provider.geo_source === 'gps' && typeof provider.geo_source_confidence === 'number'
  ? `GPS ${provider.geo_source_confidence <= 100 ? 'preciso' : 'aproximado'} (±${Math.round(provider.geo_source_confidence)}m).`
  : 'Permite ordenar por proximidade real (Haversine) e calcular distância exata.',
```

Resumo do contrato:

* **`geo_source_confidence` NULL** → checklist exibe a mensagem genérica de proximidade, sem badge "preciso/aproximado".
* **`neighborhood_source` NULL** → o item "bairro real" aparece como **pendente** (igual a quando vem `'default_centro'`), incentivando o usuário a editar.
* **`latitude/longitude` NULL** → item "Coordenadas GPS" aparece como pendente; ranking por proximidade fica indisponível, mas o cadastro continua publicável.

## Quando seria necessária migração?

Apenas se decidirmos **tornar essas colunas obrigatórias** (NOT NULL) ou criar **CHECKs** de domínio (ex.: `neighborhood_source IN (...)`). Hoje o domínio é validado **no front-end** e em uma trigger leve para `'Centro'`, o que mantém compat com providers legados.

## Backfill (opcional, não bloqueante)

Se um dia quisermos popular retroativamente `geo_source` para providers antigos, o caminho é o edge function arquivado em `scripts/archive/edge-functions/backfill-provider-coords/`. Não é necessário rodar para a feature funcionar.

## Auditoria via logs

Toda escrita passa pelos logs estruturados `[loc-persist]` em `PhaseProLocation.tsx` e `BetModeShell.tsx`. Para inspecionar providers com NULL em produção:

```sql
select count(*) filter (where geo_source is null) as sem_geo_source,
       count(*) filter (where neighborhood_source is null) as sem_neigh_source,
       count(*) filter (where latitude is null) as sem_lat
from providers;
```

Esse número só **decresce** com o tempo (novos cadastros sempre populam) — não há urgência de migração.
