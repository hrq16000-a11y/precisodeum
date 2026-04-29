import { describe, it, expect } from 'vitest';
import { applySearchFilters, type FilterableProvider } from '@/lib/searchFilters';

const mk = (id: string, overrides: Partial<FilterableProvider> = {}): FilterableProvider => ({
  id,
  userId: id,
  name: id,
  neighborhood: '',
  phone: '',
  whatsapp: '+5511999999999',
  featured: false,
  rating: 4,
  reviewCount: 10,
  yearsExperience: 5,
  ...overrides,
});

describe('applySearchFilters — status filter (online_first / online_only / recently_offline)', () => {
  it('online_first preserves nearest order within each group', () => {
    const list = [
      mk('a', { distanceKm: 1.0 }),
      mk('b', { distanceKm: 2.0 }),
      mk('c', { distanceKm: 3.0 }),
      mk('d', { distanceKm: 4.0 }),
    ];
    const onlineSet = new Set(['c', 'b']);
    const out = applySearchFilters(list, { onlineSet, sortBy: 'nearest', statusFilter: 'online_first' });
    // Sorted by distance: a(1), b(2), c(3), d(4)
    // Online block (b, c) bubbles up preserving distance order; offline block (a, d) follows preserving order.
    expect(out.map((p) => p.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('online_first preserves rating order within each group', () => {
    const list = [
      mk('a', { rating: 3.0 }),
      mk('b', { rating: 5.0 }),
      mk('c', { rating: 4.0 }),
      mk('d', { rating: 4.9 }),
    ];
    const onlineSet = new Set(['a', 'd']);
    const out = applySearchFilters(list, { onlineSet, sortBy: 'rating', statusFilter: 'online_first' });
    // Sort by rating: b(5), d(4.9), c(4), a(3)
    // Online (d, a) first, then offline (b, c)
    expect(out.map((p) => p.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('online_only filters out everyone not currently online', () => {
    const list = [mk('a'), mk('b'), mk('c')];
    const onlineSet = new Set(['b']);
    const out = applySearchFilters(list, { onlineSet, statusFilter: 'online_only' });
    expect(out.map((p) => p.id)).toEqual(['b']);
  });

  it('recently_offline keeps only providers in the recentlyOfflineSet without breaking ranking', () => {
    const list = [
      mk('a', { rating: 5 }),
      mk('b', { rating: 4 }),
      mk('c', { rating: 4.5 }),
    ];
    const recentlyOfflineSet = new Set(['c', 'a']);
    const out = applySearchFilters(list, {
      onlineSet: new Set(),
      recentlyOfflineSet,
      statusFilter: 'recently_offline',
      sortBy: 'rating',
    });
    // Only a and c kept; sorted by rating → a(5), c(4.5)
    expect(out.map((p) => p.id)).toEqual(['a', 'c']);
  });
});
