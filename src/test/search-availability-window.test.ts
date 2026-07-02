/**
 * Cobre o filtro `availabilityWindow` adicionado em /buscar.
 * Valida que 'today' e 'this_week' restringem corretamente o conjunto.
 */
import { describe, it, expect } from 'vitest';
import { applySearchFilters, FilterableProvider } from '@/lib/searchFilters';

function p(id: string, over: Partial<FilterableProvider> = {}): FilterableProvider {
  return {
    id,
    userId: `u-${id}`,
    name: `P${id}`,
    businessName: '',
    neighborhood: 'Centro',
    phone: '11999999999',
    whatsapp: '11999999999',
    featured: false,
    rating: 4,
    reviewCount: 10,
    yearsExperience: 5,
    latitude: null,
    longitude: null,
    distanceKm: 1,
    ...over,
  };
}

describe('availabilityWindow', () => {
  const list = [p('1'), p('2'), p('3'), p('4')];
  const onlineSet = new Set(['u-1']);
  const activeTodaySet = new Set(['u-2']);
  const recentlyOfflineSet = new Set(['u-3']);

  it("'any' não filtra ninguém", () => {
    const r = applySearchFilters(list, {
      availabilityWindow: 'any',
      onlineSet,
      activeTodaySet,
      recentlyOfflineSet,
    });
    expect(r.map((x) => x.id).sort()).toEqual(['1', '2', '3', '4']);
  });

  it("'today' mantém apenas online ou activeToday", () => {
    const r = applySearchFilters(list, {
      availabilityWindow: 'today',
      onlineSet,
      activeTodaySet,
      recentlyOfflineSet,
    });
    expect(r.map((x) => x.id).sort()).toEqual(['1', '2']);
  });

  it("'this_week' inclui recentlyOffline também", () => {
    const r = applySearchFilters(list, {
      availabilityWindow: 'this_week',
      onlineSet,
      activeTodaySet,
      recentlyOfflineSet,
    });
    expect(r.map((x) => x.id).sort()).toEqual(['1', '2', '3']);
  });

  it("'recent' tem o mesmo efeito de 'this_week'", () => {
    const r = applySearchFilters(list, {
      availabilityWindow: 'recent',
      onlineSet,
      activeTodaySet,
      recentlyOfflineSet,
    });
    expect(r.map((x) => x.id).sort()).toEqual(['1', '2', '3']);
  });
});
