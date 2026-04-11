

# Compressão WebP Real no Upload + Indicador de Economia + Serviços

## Problema
O MODE 2 da Edge Function `optimize-image` (upload de arquivo novo) apenas faz upload do arquivo original com deduplicação SHA-256, mas **não comprime**. A compressão real (MODE 1) só acontece para arquivos já existentes. Isso significa que fotos de portfólio e serviço são armazenadas no tamanho original.

## Solução em 3 partes

### 1. Edge Function: adicionar compressão real no MODE 2

**Arquivo:** `supabase/functions/optimize-image/index.ts`

Após o upload no MODE 2 (linhas 284-301), adicionar o mesmo fluxo de otimização do MODE 1:
- Upload do arquivo original (já existente)
- Chamar `optimizeViaTransform()` para obter versão comprimida
- Re-upload com `storage.update()` substituindo o original
- Retornar `original_size`, `optimized_size`, `savings_percent` na resposta JSON

Isso garante que **todo novo upload** já é armazenado comprimido.

### 2. Indicador visual de economia no portfólio

**Arquivo:** `src/pages/DashboardPortfolioPage.tsx`

Após receber a resposta da edge function com `savings_percent`, exibir um toast detalhado:
```
toast.success(`Imagem otimizada: 2.1MB → 180KB (-91%)`)
```
Usar os campos `original_size`, `optimized_size` e `savings_percent` retornados pela edge function.

### 3. Compressão automática no upload de imagens de serviço

**Arquivo:** `src/components/ServiceImageUpload.tsx`

Substituir o upload direto (`supabase.storage.from('service-images').upload(...)`) pela mesma chamada `fetch` à edge function `optimize-image`, idêntica ao padrão já usado no portfólio:
- `FormData` com `file`, `bucket: 'service-images'`, `folder: '{userId}/{serviceId}'`
- Usar `data.url` e `data.path` retornados
- Exibir toast com economia de tamanho

## Detalhes técnicos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/optimize-image/index.ts` | Adicionar otimização pós-upload no MODE 2 (linhas 284-301) |
| `src/pages/DashboardPortfolioPage.tsx` | Toast com indicador de economia usando campos da resposta |
| `src/components/ServiceImageUpload.tsx` | Substituir upload direto por chamada à edge function |

Sem migração de banco necessária.

### Teste
Após implementação, testar upload de foto no portfólio via preview para confirmar compressão e indicador visual.

