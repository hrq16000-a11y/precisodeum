

# Correção: Vincular Dados Reais de Avatar + Portfólio + Lógica DESTAQUE com OR

## Diagnóstico dos Dados Reais

| Dado | Coluna providers | Dado real |
|---|---|---|
| Avatar/Foto | `photo_url` = NULL (100%) | 74 avatars no storage + Google photos nos profiles |
| Portfólio | `portfolio_album_count` = 0 (100%) | 639 fotos no storage legado (flat) |
| Serviços | `services_count` correto | 83 providers com serviços |
| Descrição | campo OK | 146 providers com descrição |

**O problema**: os campos `photo_url`, `portfolio_album_count` e `portfolio_photo_count` nunca são sincronizados com os dados reais. O código do DESTAQUE verifica esses campos vazios, então nenhum provider ganha o selo.

## Plano de Correção

### 1. Migration: Backfill `photo_url` e contadores de portfólio

```sql
-- Sincronizar photo_url a partir da profiles.avatar_url
UPDATE providers p SET photo_url = prof.avatar_url
FROM profiles prof
WHERE prof.id = p.user_id
  AND (p.photo_url IS NULL OR p.photo_url = '')
  AND prof.avatar_url IS NOT NULL AND prof.avatar_url != ''
  AND prof.avatar_url NOT LIKE '%ui-avatars.com%';

-- Sincronizar portfolio_photo_count a partir do storage real
UPDATE providers p SET portfolio_photo_count = sub.cnt
FROM (
  SELECT SPLIT_PART(name, '/', 1)::uuid as uid, COUNT(*) as cnt
  FROM storage.objects WHERE bucket_id = 'portfolio'
  GROUP BY SPLIT_PART(name, '/', 1)
) sub
WHERE p.user_id = sub.uid AND (p.portfolio_photo_count IS NULL OR p.portfolio_photo_count = 0);
```

### 2. Código: Avatar no mapeamento usa `profiles.avatar_url` (já funciona)

Linha 228 do `useProviders.tsx` já faz `p.photo_url || profile?.avatar`. Após o backfill, `photo_url` estará preenchido para quem tem avatar real.

### 3. Lógica DESTAQUE → OR (3 arquivos)

Mudar a condição de AND para OR em `ProviderCard.tsx`, `FeaturedProviders.tsx` e `ProviderProfile.tsx`:

```
premium && (hasOwnPhoto || servicesCount >= min || portfolioPhotoCount > 0 || hasDescription)
```

Cada sub-critério continua respeitando o toggle do admin. O avatar **não** é obrigatório — basta ter pelo menos 1 dos critérios preenchidos.

### 4. Admin: adicionar `destaque_require_description` no painel

- Inserir chave `destaque_require_description = true` em `site_settings`
- Adicionar toggle na seção "Regras de Perfil" do `AdminSettingsPage.tsx`

### 5. FeaturedProviders: DiceBear avatar + lógica OR

O card `ProviderCardFeatured` atualmente usa fallback de iniciais. Trocar para DiceBear como nos demais cards e aplicar a mesma lógica OR do DESTAQUE.

## Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| Data (INSERT/UPDATE) | Backfill photo_url e portfolio_photo_count |
| `src/components/ProviderCard.tsx` | Lógica DESTAQUE com OR |
| `src/components/home/FeaturedProviders.tsx` | DiceBear avatar + lógica DESTAQUE OR |
| `src/pages/ProviderProfile.tsx` | Lógica DESTAQUE com OR |
| `src/pages/AdminSettingsPage.tsx` | Toggle "Exigir descrição" |

Nenhum provider será escondido. Todos continuam aparecendo. Apenas o selo DESTAQUE (coroa) será concedido com critérios reais baseados nos dados que já existem.

