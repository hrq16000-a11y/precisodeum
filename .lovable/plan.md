

# Otimização em Lote das Imagens de Portfólio Existentes

## Situação atual
- **419 imagens** acima de 200KB no bucket `portfolio`
- **~870MB** de espaço desperdiçado (imagens de 200KB a 4.8MB)
- A Edge Function `optimize-image` já suporta otimizar arquivos existentes (MODE 1: JSON com bucket + path)

## Solução
Criar uma nova Edge Function `batch-optimize-portfolio` que:
1. Lista todos os arquivos do bucket `portfolio` recursivamente
2. Para cada imagem acima de 200KB, chama internamente a mesma lógica de otimização da `optimize-image` (Supabase Image Transforms)
3. Processa em lotes de 10 para não sobrecarregar
4. Retorna relatório com total processado, economia total, e erros

## Implementação

### Nova Edge Function: `supabase/functions/batch-optimize-portfolio/index.ts`
- Autenticação: requer admin (verifica `has_role`)
- Escaneia recursivamente o bucket `portfolio`
- Filtra apenas arquivos > 200KB e com extensão jpg/jpeg/png/webp (ignora GIF e MP4)
- Para cada arquivo, usa `optimizeViaTransform()` (mesma lógica da `optimize-image`) para obter versão otimizada
- Re-upload com `supabase.storage.update()` substituindo o original
- Atualiza `size_optimized` na tabela `media` quando aplicável
- Retorna JSON com: `total_scanned`, `total_optimized`, `total_skipped`, `savings_kb`, `errors[]`

### Adicionar botão na página Admin Mídia
- Em `AdminMediaPage.tsx`, adicionar botão "Otimizar Portfólio" que chama a nova Edge Function
- Mostra progresso e resultado final com toast

## Detalhes técnicos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/batch-optimize-portfolio/index.ts` | Nova Edge Function para otimização em lote |
| `src/pages/AdminMediaPage.tsx` | Botão para disparar a otimização em lote |

Sem migração de banco necessária.

