

# Correção Pendente: Sincronizar `portfolio_album_count` via Migration SQL Direta

## Situação

A lógica dos cards e do DESTAQUE está correta (OR). Os profissionais aparecem na home e nas categorias (150 dos 164). O problema restante é que `portfolio_album_count = 0` para todos — a edge function de migração de álbuns ainda não foi executada.

Em vez de depender do botão admin (que exige deploy da edge function), a correção mais confiável é uma **migration SQL direta** que:

1. Cria um álbum "Meus Trabalhos" para cada provider que tem fotos na `media` (entity_type=portfolio) mas 0 álbuns
2. Insere registros em `portfolio_photos` vinculando as fotos existentes
3. Atualiza `portfolio_album_count` nos providers

## Etapa Única: Migration SQL

```text
Para cada user_ref com fotos na media (entity_type=portfolio):
  → Localizar provider via profiles.id = providers.user_id
  → INSERT INTO portfolio_albums (provider_id, user_id, name)
  → INSERT INTO portfolio_photos (album_id, image_url, storage_path) FROM media
  → UPDATE providers SET portfolio_album_count = count de álbuns
```

Isso ativa imediatamente o critério `portfolioAlbumCount > 0` no DESTAQUE para os 58 profissionais com portfólio.

## Arquivo

| Arquivo | Alteração |
|---|---|
| Migration SQL | Criar álbuns + vincular fotos + atualizar contadores |

Nenhuma mudança de código — apenas dados. A lógica nos cards já está pronta para consumir esses valores.

