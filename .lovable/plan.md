

# Plano: Sincronização de Portfólio + Migração para Álbuns + Admin

## Situação Atual

| Dado | Valor |
|---|---|
| Registros na `media` (portfolio) | 1.689 fotos de 58 profissionais |
| `portfolio_albums` | 0 registros |
| `portfolio_photos` | 0 registros |
| `providers.portfolio_photo_count` | 0 para todos |

As fotos existem na `media` com `storage_path` tipo `portfolio/{user_uuid}/arquivo.jpg` e `user_ref` correto — mas nunca foram migradas para as tabelas `portfolio_albums` / `portfolio_photos`, e os contadores nos providers estão zerados.

## Etapas

### 1. Migration SQL — Migrar fotos legadas para álbuns temáticos

Para cada profissional com fotos na `media`:
- Criar 1 álbum "Meus Trabalhos" na `portfolio_albums` (vinculado ao `provider_id` e `user_id`)
- Inserir cada foto da `media` como registro em `portfolio_photos` (vinculado ao `album_id`)
- Atualizar `providers.portfolio_photo_count` e `portfolio_album_count` com contagens reais

```text
media (entity_type=portfolio, user_ref)
  → profiles (user_ref → id = user_id)
    → providers (user_id → id = provider_id)
      → portfolio_albums (provider_id, name="Meus Trabalhos")
        → portfolio_photos (album_id, image_url, storage_path)
```

### 2. Migration SQL — Trigger de sincronização automática

Criar uma função `sync_portfolio_count_from_media()` que:
- Dispara em INSERT/DELETE na tabela `media` quando `entity_type = 'portfolio'`
- Localiza o `provider_id` via `user_ref → profiles → providers`
- Recalcula `portfolio_photo_count` no provider

Isso mantém os contadores atualizados automaticamente em novos uploads.

### 3. Migration SQL — Inserir setting `destaque_require_description`

A setting já existe no banco com valor `false`. Apenas garantir que o toggle está funcional no admin.

### 4. AdminSettingsPage.tsx — Botão "Migrar Fotos Legadas"

Adicionar na seção "Regras de Perfil" um botão operacional que:
- Chama uma edge function `migrate-portfolio-albums`
- Cria álbuns "Meus Trabalhos" para profissionais que têm fotos na `media` mas 0 álbuns
- Vincula as fotos existentes ao álbum
- Mostra progresso e resultado (X álbuns criados, Y fotos vinculadas)

### 5. AdminSettingsPage.tsx — Toggle `destaque_require_description`

O array `PROFILE_RULE_KEYS` já contém `destaque_require_description` (verificado no código). Confirmar que está funcional e visível.

### 6. Edge Function `migrate-portfolio-albums`

Função que:
1. Busca profissionais com fotos na `media` (portfolio) sem álbuns em `portfolio_albums`
2. Cria álbum "Meus Trabalhos" para cada um
3. Insere registros em `portfolio_photos` com os dados da `media`
4. Atualiza contadores nos providers
5. Retorna relatório: `{ albumsCriados, fotosVinculadas }`

### 7. Verificação do selo DESTAQUE

Após a migração, os contadores `portfolio_photo_count` e `portfolio_album_count` terão valores reais. A lógica OR atual no `ProviderCard.tsx` (linha 106-110) já verifica `portfolioAlbumCount > 0`, então o selo passará a aparecer corretamente para os 58 profissionais com portfólio.

## Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| Migration SQL | Migrar media → albums/photos + atualizar contadores + trigger automático |
| Edge Function `migrate-portfolio-albums` | Migração operacional sob demanda |
| `src/pages/AdminSettingsPage.tsx` | Botão "Migrar Fotos Legadas" + confirmar toggle descrição |

## Nenhum profissional será escondido

Apenas dados internos (contadores e álbuns) serão criados/atualizados. A visibilidade dos profissionais não muda.

