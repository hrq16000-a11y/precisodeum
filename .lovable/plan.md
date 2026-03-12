

## Plan: 4 Features in One Pass

### 1. Admin Cities Page (`/admin/cidades`)
- Create `AdminCitiesPage.tsx` with full CRUD (same pattern as `AdminCategoriesPage.tsx`)
- Fields: name, state, slug
- Add route in `App.tsx`
- Add "Cidades" menu item in `AdminLayout.tsx` with `MapPin` icon

### 2. Smart Search Ranking
- Update `useSearchProviders` in `useProviders.tsx` to order by: `plan` priority (premium > pro > free), then `rating_avg` DESC, then `review_count` DESC
- Use Supabase `.order()` chaining — no DB changes needed

### 3. Dynamic Sitemap Edge Function
- Create `supabase/functions/sitemap/index.ts` edge function
- Queries `categories` and `cities` tables, generates XML with all `/{category}-{city}` combinations plus `/cidade/{city}` and `/categoria/{category}` URLs
- Returns `Content-Type: application/xml`
- Accessible at `https://<project>.supabase.co/functions/v1/sitemap`

### 4. Enhanced Footer (no behavior changes)
- Redesign `Footer.tsx` with 6 columns on desktop (responsive grid):
  1. **Brand** — "PRECISO DE UM" description
  2. **Serviços Populares** — hardcoded links to category pages (Eletricista, Encanador, etc.)
  3. **Cidades** — dynamic from DB (existing query)
  4. **Profissionais** — Cadastro, Login, Dashboard links
  5. **Ecossistema** — external links to encontreumtecnico.com, precisodeumtecnico.com, etc.
  6. **Contato** — email, phone, WhatsApp link
- Keep existing SEO links grid ("Buscas populares")
- Copyright at bottom

### Files Changed
- **Create**: `src/pages/AdminCitiesPage.tsx`, `supabase/functions/sitemap/index.ts`
- **Edit**: `src/App.tsx` (add route), `src/components/AdminLayout.tsx` (add menu item), `src/hooks/useProviders.tsx` (ranking), `src/components/Footer.tsx` (redesign)

