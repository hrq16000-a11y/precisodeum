

# Compressão Automática WebP no Upload de Portfólio

## Problema
O upload de portfólio envia o arquivo original direto ao storage sem otimização, resultando em imagens pesadas (JPEG/PNG de 2-5MB) que prejudicam o carregamento.

## Solução
Redirecionar o upload de portfólio pela Edge Function `optimize-image` já existente, que faz deduplicação SHA-256 e upload otimizado — e depois aplicar a transformação via `/render/image/` para servir WebP comprimido.

## Implementação

### 1. Alterar `DashboardPortfolioPage.tsx`
No loop de upload de fotos (linhas ~182-222), substituir o upload direto (`supabase.storage.from('portfolio').upload(...)`) por uma chamada à Edge Function `optimize-image` via `fetch`, passando `bucket: 'portfolio'` e `folder: '{userId}/{albumId}'`. A edge function já faz:
- Validação de tipo/tamanho
- Hash SHA-256 para deduplicação
- Upload ao storage

### 2. Alterar `DashboardMyPagePage.tsx`
Aplicar a mesma mudança no upload de capa do portfólio (linha ~190).

### 3. Sem mudanças na Edge Function
A `optimize-image` já suporta o bucket `portfolio` na lista `ALLOWED_BUCKETS` e o modo multipart/form-data com folder customizado.

## Detalhes técnicos

| Arquivo | Alteração |
|---|---|
| `src/pages/DashboardPortfolioPage.tsx` | Substituir `supabase.storage.upload` por chamada à edge function `optimize-image` |
| `src/pages/DashboardMyPagePage.tsx` | Mesma substituição para upload de capa |

Nenhuma migração de banco necessária. Nenhuma nova edge function.

