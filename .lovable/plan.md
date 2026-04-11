

## Plano: Adaptar Destaques com novos campos e 3 cards de vantagens

### Situação atual

A tabela `highlights` possui: `id`, `title`, `description`, `image_url`, `link_url`, `display_order`, `active`, `created_at`, `updated_at`.

Faltam os campos: `icon` (nome do ícone lucide), `theme_color` (classe Tailwind de cor), `button_text` (texto do botão).

### Alterações

**1. Migration — adicionar 3 colunas + seed dos 3 cards**

```sql
ALTER TABLE public.highlights ADD COLUMN IF NOT EXISTS icon text DEFAULT 'Sparkles';
ALTER TABLE public.highlights ADD COLUMN IF NOT EXISTS theme_color text DEFAULT 'text-orange-500';
ALTER TABLE public.highlights ADD COLUMN IF NOT EXISTS button_text text DEFAULT 'Saiba mais';

-- Seed: 3 cards de vantagens
INSERT INTO public.highlights (title, description, icon, theme_color, button_text, link_url, display_order, active)
VALUES
  ('Lucro 100% Seu', 'Não cobramos comissão sobre os serviços que você fecha através da plataforma.', 'Sparkles', 'text-orange-500', 'Saiba mais →', '/cadastro', 1, true),
  ('Contato Direto', 'O cliente clica, o seu WhatsApp toca. Sem intermediários atrapalhando o negócio.', 'Smartphone', 'text-blue-500', 'Como funciona →', '/como-funciona', 2, true),
  ('Transparência Total', 'Você negocia valores e prazos direto com o cliente. O acordo é 100% entre vocês.', 'Handshake', 'text-emerald-500', 'Ver vantagens →', '/vantagens', 3, true);
```

**2. Componente `HighlightsCarousel.tsx` — redesign completo**

- Interface atualizada com `icon`, `theme_color`, `button_text`
- Importação dinâmica de ícones via `icons` do lucide-react (mapa de ícones)
- Ícone renderizado com `size={20}` fixo e `className={h.theme_color}`
- Visual do card: `bg-slate-50` com bordas arredondadas, padding `p-6`
- Título em negrito ao lado do ícone
- Descrição em `text-slate-500`
- Botão com cor dinâmica (`h.theme_color`) e seta
- Dots de paginação: ativo = pílula `w-4 h-2 rounded-full bg-orange-500`, inativo = `w-2 h-2 rounded-full bg-gray-200`
- Remover setas de navegação (não solicitadas no novo design)
- Auto-play mantido (5s)

**3. Admin `AdminHighlightsPage.tsx` — campos novos no formulário**

- Adicionar inputs para `icon`, `theme_color`, `button_text` no formulário
- Atualizar `handleSave` para enviar os novos campos
- Atualizar `startEdit` para preencher os novos campos

### Arquivos modificados
- `src/components/home/HighlightsCarousel.tsx`
- `src/pages/AdminHighlightsPage.tsx`
- Migration SQL (via ferramenta de migração)

