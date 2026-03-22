

# Mobile-First Fix: JobsPage + BlogPage Responsiveness

## Problem
At 520px viewport (user's current view), cards on /vagas and /blog break with overflow, misaligned badges, cramped filter bars, and buttons getting cut off. The core issues are:

1. **JobsPage filters**: search + city select + 2 buttons all on one row at `sm:flex-row` — overflows at 520px
2. **JobsPage cards**: 3-col grid starts too early, badge + title row overflows, approve buttons in admin pending queues don't stack
3. **BlogPage**: featured post image can dominate mobile, card grid needs 1-col on small screens
4. **AdNativeCard**: injected into job grid but has no max-width constraint, sponsor badge overlaps title

## Changes

### 1. `src/pages/JobsPage.tsx`
- **Filters**: Make search full-width, city select full-width below it. "Filtros" and "Publicar Vaga" buttons side-by-side below that. Use `flex flex-col gap-3` always, with `sm:flex-row sm:flex-wrap` for tablet+
- **Expanded filters panel**: Selects `w-full sm:w-auto`
- **Card grid**: Change to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **Each card**: Add `min-w-0 overflow-hidden` to container. Title: `line-clamp-2 break-words`. Badge row: `flex-wrap`. Description: `line-clamp-2`. Metadata: `flex-wrap`
- **Cover image**: Add `aspect-video` for consistent height

### 2. `src/pages/BlogPage.tsx`
- **Featured post**: On mobile, stack vertically (already does via `sm:flex`). Add `min-h-0` and `max-h-48` on mobile image
- **Card grid**: Already `sm:grid-cols-2 lg:grid-cols-3` — add explicit `grid-cols-1` base
- **Cards**: Add `min-w-0 overflow-hidden`, title `break-words`, image `aspect-video object-cover`
- **Featured query**: Include `featured` column in select so the featured detection actually works (currently missing from select)

### 3. `src/components/ads/AdNativeCard.tsx`
- Ensure card matches job card dimensions with `min-w-0 overflow-hidden`
- Move "Patrocinado" badge to not overlap title — place it as a badge row above the title instead of absolute positioned

### 4. `src/components/DashboardLayout.tsx` + `src/components/AdminLayout.tsx`
- Add `overflow-y-auto` to sidebar nav to prevent menu cutoff on short screens

### 5. `src/pages/AdminPage.tsx`
- Pending queue approve/reject buttons: `flex-col sm:flex-row` on mobile so they stack vertically instead of overflowing

## Files Modified

| File | Change |
|---|---|
| `src/pages/JobsPage.tsx` | Filter layout, card grid, card overflow fixes |
| `src/pages/BlogPage.tsx` | Featured query fix, card overflow, image aspect |
| `src/components/ads/AdNativeCard.tsx` | Badge positioning, overflow fix |
| `src/components/DashboardLayout.tsx` | Sidebar scroll |
| `src/components/AdminLayout.tsx` | Sidebar scroll |
| `src/pages/AdminPage.tsx` | Pending buttons stacking |

No database changes. Pure front-end CSS/layout corrections.

