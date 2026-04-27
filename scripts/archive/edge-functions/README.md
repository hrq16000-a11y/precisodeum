# Edge Functions Arquivadas (One-Shot)

Funções históricas que cumpriram seu papel e foram **removidas do deploy ativo** no Passo 4 do roadmap de limpeza (abr/2026). Mantidas aqui apenas como registro/forense — **NÃO redeployar sem revisão**.

| Função | Propósito original | Status |
|---|---|---|
| `migrate-portfolio-albums` | Migrar mídia legada (`media.entity_type='portfolio'`) para `portfolio_albums` + `portfolio_photos`. | Concluído. Todos os providers já têm albums. |
| `backfill-provider-coords` | Geocodificar lote inicial (200) via Nominatim. | Substituído por `geocode-address` (on-demand no save). |
| `bulk-geocode-providers` | Versão completa (500/run) com fallback IBGE. | Idem acima. |
| `sync-storage-media` | Reconciliar arquivos órfãos do Storage com `public.media`. | Storage já consistente; uploads novos vão direto via `optimize-image`. |
| `batch-optimize-all` / `batch-optimize-images` / `batch-optimize-portfolio` | Conversão massiva PNG/JPEG → WebP de assets antigos. | Concluído. Novos uploads já são WebP via edge function. |

## Como restaurar (se necessário)
1. Copie a pasta de volta para `supabase/functions/<nome>/`.
2. Re-adicione bloco `[functions.<nome>]` em `supabase/config.toml` se precisar de `verify_jwt = false`.
3. Deploy automático via Lovable.
