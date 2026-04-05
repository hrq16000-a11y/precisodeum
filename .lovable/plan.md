
# Plano: CMS Modular — Páginas/Blocos + Segmentação por Empresa/Campanha

## Fase 1: Tabela `page_blocks` (blocos de página administráveis)
- Criar tabela `page_blocks` com: `page_slug`, `block_type`, `title`, `content` (jsonb), `display_order`, `active`, `target_city`, `target_category`, `target_campaign`, `sponsor_id`
- RLS: leitura pública (ativos), CRUD admin
- Permite ao admin montar seções da home e páginas institucionais como blocos reordenáveis

## Fase 2: Tabela `institutional_pages` (páginas institucionais dinâmicas)
- Criar tabela `institutional_pages` com: `slug`, `title`, `content` (rich text), `meta_title`, `meta_description`, `published`, `display_order`
- RLS: leitura pública (publicadas), CRUD admin
- Permite criar páginas como "Sobre", "Termos", "Política" direto pelo admin

## Fase 3: Painel Admin — Gestão de Blocos (`/admin/blocos`)
- CRUD de blocos com drag-to-reorder
- Filtros por página, tipo, cidade, categoria, campanha, patrocinador
- Duplicar, agendar (start/end date), ativar/desativar
- Preview inline

## Fase 4: Painel Admin — Páginas Institucionais (`/admin/paginas`)
- CRUD de páginas com editor de conteúdo
- SEO fields (meta title, description)
- Publicar/despublicar

## Fase 5: Renderização dinâmica no frontend
- Componente `DynamicPageBlocks` que lê blocos por `page_slug`
- Filtragem automática por cidade/categoria do contexto
- Rota dinâmica `/p/:slug` para páginas institucionais

## Fase 6: Menu lateral admin atualizado
- Adicionar "Blocos de Página" e "Páginas" ao menu admin
