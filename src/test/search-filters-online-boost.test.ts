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

describe('applySearchFilters — online-first stable boost', () => {
  it('pulls online providers to the top while preserving inner order', () => {
    const list = [
      mk('a', { rating: 5 }),
      mk('b', { rating: 4.9 }),
      mk('c', { rating: 4.8 }),
      mk('d', { rating: 4.7 }),
    ];
    const onlineSet = new Set(['c', 'a']); // a and c online
    const out = applySearchFilters(list, { onlineSet, sortBy: 'relevance' });
    // Online block first (in original list order: a, c), offline second (b, d)
    expect(out.map((p) => p.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('respects opt-out via disableOnlineBoost', () => {
    const list = [mk('a'), mk('b'), mk('c')];
    const onlineSet = new Set(['c']);
    const out = applySearchFilters(list, { onlineSet, disableOnlineBoost: true });
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('still applies the chosen sort within the online and offline groups', () => {
    const list = [
      mk('a', { rating: 3.0 }),
      mk('b', { rating: 5.0 }),
      mk('c', { rating: 4.0 }),
      mk('d', { rating: 4.9 }),
    ];
    const onlineSet = new Set(['a', 'd']);
    const out = applySearchFilters(list, { onlineSet, sortBy: 'rating' });
    // Sort by rating first → b(5), d(4.9), c(4), a(3)
    // Then online-first stable partition → online block: d, a ; offline block: b, c
    expect(out.map((p) => p.id)).toEqual(['d', 'a', 'b', 'c']);
  });
});
