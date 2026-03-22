

# Mobile-First Overhaul — Batch 1

This is a focused batch targeting the 4 priorities you named: mobile-first fixes, broken cards on /vagas and /blog, random highlights with "Ver mais", and dashboard simplification.

---

## 1. JobsPage — Cards + Filters (src/pages/JobsPage.tsx)

Already improved in prior round. Remaining fixes:
- Add `px-4` padding guard on the outer container to prevent edge-to-edge overflow on 520px
- Ensure the sidebar `AdSidebar` is hidden below `lg` (add `hidden lg:block` wrapper)
- Job card description: cap at `line-clamp-2` (already done), add `break-words`

## 2. BlogPage — Random Highlights Section (src/pages/BlogPage.tsx)

Replace single featured post with a **"Destaques" section** showing 3-6 random posts:
- Client-side shuffle of published posts, take first 6 as highlights
- Display in a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` grid with compact cards (image + title + date)
- Section header: "Destaques" with a "Ver todos" link
- Remaining posts listed below in the same grid pattern
- Each card: `min-w-0 overflow-hidden`, image `aspect-video object-cover`, title `line-clamp-2 break-words`, excerpt `line-clamp-2`

## 3. BlogHighlight (Home) — 3 Random Posts (src/components/home/BlogHighlight.tsx)

- Change query from 1 featured post to 10 published posts
- Client-side shuffle, display 3 in `grid-cols-1 sm:grid-cols-3`
- Compact card: thumbnail + title + date
- "Ver todos" button links to `/blog`

## 4. FeaturedJobs (Home) — Show 6 (src/components/home/FeaturedJobs.tsx)

- Increase from 4 to 6 displayed jobs
- Change grid from `lg:grid-cols-4` to `sm:grid-cols-2 lg:grid-cols-3`
- Add `min-w-0 overflow-hidden break-words` to cards

## 5. DashboardPage — Simplify (src/pages/DashboardPage.tsx)

- Remove the bottom 6-stat grid (most values are "—", looks broken)
- Keep only "Serviços cadastrados" count inline in the Quick Access "Meus Serviços" card (already there)
- Keep onboarding guide and quick access cards as-is
- Result: cleaner page without empty/meaningless stats

## 6. AdminLayout — Menu Grouping (src/components/AdminLayout.tsx)

Group menu items with subtle labels:
- **Conteudo**: Categorias, Vagas, Blog, FAQ, Destaques, Servicos Populares
- **Gestao**: Prestadores, Usuarios, Comunidade
- **Comercial**: Patrocinadores, Estatisticas
- **Sistema**: Meta Tags & SEO, Configuracoes

Add `overflow-y-auto` with calculated max-height on sidebar nav.

## 7. DashboardLayout — Sidebar Scroll (src/components/DashboardLayout.tsx)

Already has `overflow-y-auto` from prior round. Confirm `maxHeight` calc is correct.

## 8. AdminPage — Mobile Buttons (src/pages/AdminPage.tsx)

Pending queue approve/reject buttons already stack with `flex-col sm:flex-row` from prior round. No further changes needed.

---

## Files Modified

| File | Change |
|---|---|
| `src/pages/BlogPage.tsx` | Random highlights section (3-6 shuffled), grid cards |
| `src/components/home/BlogHighlight.tsx` | 3 random posts grid instead of 1 |
| `src/components/home/FeaturedJobs.tsx` | Show 6, grid-cols-3 |
| `src/pages/DashboardPage.tsx` | Remove empty stats grid |
| `src/components/AdminLayout.tsx` | Menu grouping with labels |

No database changes needed. Pure front-end.

