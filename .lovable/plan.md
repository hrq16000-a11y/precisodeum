

# Fix: Priority sorting for user's detected city + IP precision indicator

## Problem

Providers are sorted strictly by Haversine distance from the user's coordinates. When coordinates come from IP geolocation (imprecise, ~5-20km error), a provider in Fazenda Rio Grande (different city) can appear closer than one in São José dos Pinhais (user's own city). The system doesn't distinguish "same city as user" from "nearby city" when sorting.

Additionally, there's no visual indicator that the location is IP-based and may be inaccurate.

## Root Cause

1. All providers in a city share the same city-center coordinates (geocoded fallback), so distance differences between nearby cities are tiny (2-5km) — well within IP geolocation error margins.
2. The sorting algorithm treats all distance calculations equally regardless of coordinate precision.
3. The `GeoPromptBanner` shows a generic radius banner for IP-based location without indicating it's approximate.

## Plan

### 1. Add "same city as user" priority boost in sorting (CategoryPage.tsx)

In the sorting logic within `CategoryPage.tsx`, before distance sorting, add a priority tier:
- **Tier 1**: Provider's city matches user's detected city (exact name match) — always ranked first
- **Tier 2**: Within radius, sorted by distance
- This ensures that São José dos Pinhais providers always appear before Fazenda Rio Grande providers when the user is detected in SJP, regardless of imprecise IP coordinates.

Apply the same logic in:
- `CategoryPage.tsx` (category listing — the main issue shown)
- `CityPage.tsx` (city listing)
- `useProviders.tsx` `filterAndRankProvidersGrouped()` (search results)

### 2. Show "approximate location" indicator in GeoPromptBanner

When `precise === false` (IP-based), update the banner to show:
- "GPS PRECISO" → keep as-is when GPS is active
- New: "Localização aproximada" with a subtle warning icon when IP-based
- Add small text: "A ordenação por distância pode ter variações. Ative o GPS para resultados mais precisos."

### 3. Add precision label in header GeoLocationChip area

In the `GeoPromptBanner` component, when `precise === false` and `hasGps === true` (has IP coords but not GPS), change the label from the current generic radius display to include "Ref. aproximada" to match what the user sees in the screenshot ("GPS PRECISO" vs approximate).

## Technical Details

**Files to modify:**
- `src/pages/CategoryPage.tsx` — add city-match priority tier in `distSort`
- `src/pages/CityPage.tsx` — same sorting fix in the providers `useMemo`
- `src/hooks/useProviders.tsx` — add city-match priority in `filterAndRankProvidersGrouped()` local sorting
- `src/components/GeoPromptBanner.tsx` — show "approximate" indicator when `precise === false`

**Sorting logic change (pseudo-code):**
```
sort(a, b):
  // Tier 1: same city as user comes first
  aCityMatch = normalize(a.city) === normalize(userCity)
  bCityMatch = normalize(b.city) === normalize(userCity)
  if (aCityMatch !== bCityMatch) return aCityMatch ? -1 : 1
  
  // Tier 2: sort by distance (existing logic)
  return distSort(a, b)
```

**No database changes needed.**
