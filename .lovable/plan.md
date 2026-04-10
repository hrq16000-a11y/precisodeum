

## Correção: Geolocalização de Busca Funcionando Sem Margem de Erro

### Problema Raiz
1. **100% dos providers existentes têm `latitude`/`longitude` NULL** — a busca por distância (Haversine) nunca é usada
2. Sem coordenadas, o fallback por nome falha porque "Região Metropolitana de Curitiba" ≠ "São José dos Pinhais"
3. O `extractCoreCity` extrai "curitiba" mas não faz match com "saojosedospinhais"

### Solução (3 frentes)

**1. Backfill de coordenadas dos providers existentes (edge function)**
- Criar uma edge function `backfill-provider-coords` que:
  - Busca todos os providers com `latitude IS NULL`
  - Para cada um, usa a API Nominatim (gratuita) para geocodificar `city + state + Brasil`
  - Atualiza `latitude`, `longitude` e `ibge_code` no banco
  - Processa em lotes com delay (1 req/s para respeitar rate limit do Nominatim)
- Botão no admin para disparar o backfill

**2. Garantir coordenadas no cadastro (já implementado, mas validar)**
- Já salva lat/lon no signup e perfil — apenas garantir que o campo é obrigatório antes do submit (bloqueando cadastro sem cidade selecionada do IBGE)

**3. Melhorar fallback de nome para casos sem coordenadas**
- Enquanto o backfill não rodar, melhorar `matchesGeoContext`:
  - Quando o user city contém "região metropolitana", fazer match por **estado** (mesmo UF = local)
  - Isso garante que "Região Metropolitana de Curitiba" + PR encontra providers de "São José dos Pinhais, PR"

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `supabase/functions/backfill-provider-coords/index.ts` | Criar (edge function de geocodificação em lote) |
| `src/hooks/useProviders.tsx` | Editar (melhorar fallback região metropolitana → match por estado) |
| `src/pages/AdminProvidersPage.tsx` | Editar (botão para disparar backfill) |

### Detalhe técnico do fallback melhorado

```text
matchesGeoContext():
  Se userCity contém "regiaometropolitana":
    → extrair estado do user (ex: PR)
    → Se provider.state === userState → match = true
    
  Isso cobre 100% dos casos de região metropolitana
  até que as coordenadas existam para usar Haversine
```

### Resultado esperado
- Imediatamente: providers de PR aparecem ao buscar "Região Metropolitana de Curitiba"
- Após backfill: busca por distância real (100km) funciona para todos
