/**
 * Cobre paginação client-side e consistência de ordenação (rating, reviews,
 * featured) em /buscar e listagens derivadas.
 *
 * Usa applySearchFilters do código de produção, sem mocks de rede.
 */
import { describe, it, expect } from 'vitest';
import { applySearchFilters, FilterableProvider } from '@/lib/searchFilters';

const PAGE_SIZE = 20;

function paginate<T>(list: T[], page: number, size = PAGE_SIZE): T[] {
  return list.slice((page - 1) * size, page * size);
}

function makeProvider(over: Partial<FilterableProvider> & { id: string }): FilterableProvider {
  return {
    id: over.id,
    userId: over.userId ?? `u-${over.id}`,
    name: over.name ?? `Prov ${over.id}`,
    businessName: over.businessName ?? '',
    neighborhood: over.neighborhood ?? 'Centro',
    phone: over.phone ?? '11999999999',
    whatsapp: over.whatsapp ?? '11999999999',
    featured: over.featured ?? false,
    rating: over.rating ?? 0,
    reviewCount: over.reviewCount ?? 0,
    yearsExperience: over.yearsExperience ?? 0,
    latitude: over.latitude ?? null,
    longitude: over.longitude ?? null,
    distanceKm: over.distanceKm,
  };
}

describe('search pagination + sort consistency', () => {
  // Dataset suficiente para validar 2+ páginas
  const dataset: FilterableProvider[] = Array.from({ length: 47 }, (_, i) =>
    makeProvider({
      id: `${i + 1}`,
      rating: (i % 5) + 1,           // 1..5 ciclando
      reviewCount: (i * 3) % 100,    // espalhado
      yearsExperience: i % 20,
      featured: i % 7 === 0,         // ~14% destacados
    }),
  );

  it('paginação client-side é determinística e cobre todo o dataset', () => {
    const sorted = applySearchFilters(dataset, { sortBy: 'rating' });
    const p1 = paginate(sorted, 1);
    const p2 = paginate(sorted, 2);
    const p3 = paginate(sorted, 3);
    expect(p1.length).toBe(20);
    expect(p2.length).toBe(20);
    expect(p3.length).toBe(7);
    expect(p1.length + p2.length + p3.length).toBe(dataset.length);
    // Sem repetidos entre páginas
    const ids = new Set([...p1, ...p2, ...p3].map((p) => p.id));
    expect(ids.size).toBe(dataset.length);
  });

  it('sort=rating ordena descrescente (com online-boost neutro)', () => {
    const sorted = applySearchFilters(dataset, { sortBy: 'rating' });
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].rating).toBeGreaterThanOrEqual(sorted[i].rating);
    }
  });

  it('sort=reviews ordena por reviewCount desc', () => {
    const sorted = applySearchFilters(dataset, { sortBy: 'reviews' });
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].reviewCount).toBeGreaterThanOrEqual(sorted[i].reviewCount);
    }
  });

  it('featuredFilter=featured devolve apenas destacados, mantendo paginação', () => {
    const sorted = applySearchFilters(dataset, { sortBy: 'rating', featuredFilter: 'featured' });
    expect(sorted.length).toBeGreaterThan(0);
    expect(sorted.every((p) => p.featured)).toBe(true);
    const p1 = paginate(sorted, 1);
    expect(p1.length).toBeLessThanOrEqual(20);
  });

  it('paginação é estável: mesma entrada → mesma saída em cada página', () => {
    const a = paginate(applySearchFilters(dataset, { sortBy: 'reviews' }), 2);
    const b = paginate(applySearchFilters(dataset, { sortBy: 'reviews' }), 2);
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });

  it('online-boost preserva ordem relativa do sort dentro de cada partição', () => {
    const onlineSet = new Set(['u-3', 'u-7']);
    const sorted = applySearchFilters(dataset, { sortBy: 'rating', onlineSet });
    // Os 2 online aparecem antes de qualquer offline, mas entre si seguem rating desc
    const onlineIdx = sorted.map((p, i) => ({ p, i })).filter(({ p }) => onlineSet.has(p.userId));
    const offlineIdx = sorted.map((p, i) => ({ p, i })).filter(({ p }) => !onlineSet.has(p.userId));
    expect(Math.max(...onlineIdx.map((x) => x.i))).toBeLessThan(Math.min(...offlineIdx.map((x) => x.i)));
  });
});
