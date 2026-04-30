/**
 * Cobre o sort `'best'` (score híbrido rating+distância) e a configurabilidade
 * de pesos via DEFAULT_SCORE_WEIGHTS / scoreWeights.
 */
import { describe, it, expect } from 'vitest';
import {
  applySearchFilters,
  computeProviderScore,
  DEFAULT_SCORE_WEIGHTS,
  type FilterableProvider,
} from '@/lib/searchFilters';

function p(id: string, rating: number, distanceKm: number, reviews = 0): FilterableProvider {
  return {
    id,
    userId: `u-${id}`,
    name: `P${id}`,
    businessName: '',
    neighborhood: 'Centro',
    phone: '11999999999',
    whatsapp: '11999999999',
    featured: false,
    rating,
    reviewCount: reviews,
    yearsExperience: 0,
    latitude: null,
    longitude: null,
    distanceKm,
  };
}

describe("sortBy='best' (score híbrido rating+distância)", () => {
  it('rating maior vence quando distâncias são iguais', () => {
    const list = [p('A', 3.0, 5), p('B', 4.8, 5), p('C', 4.0, 5)];
    const sorted = applySearchFilters(list, { sortBy: 'best' });
    expect(sorted.map((x) => x.id)).toEqual(['B', 'C', 'A']);
  });

  it('com ratings iguais, distância funciona como desempate', () => {
    const list = [p('A', 4.5, 30), p('B', 4.5, 2), p('C', 4.5, 15)];
    const sorted = applySearchFilters(list, { sortBy: 'best' });
    expect(sorted.map((x) => x.id)).toEqual(['B', 'C', 'A']);
  });

  it('rating tem prioridade sobre proximidade com pesos default (0.7/0.3)', () => {
    // A: rating top, longe.   B: rating médio, perto.
    const list = [p('A', 5.0, 40), p('B', 3.5, 1)];
    const sorted = applySearchFilters(list, { sortBy: 'best' });
    expect(sorted[0].id).toBe('A');
  });

  it('pesos custom (distance dominante) invertem a ordem', () => {
    const list = [p('A', 5.0, 40), p('B', 3.5, 1)];
    const sorted = applySearchFilters(list, {
      sortBy: 'best',
      scoreWeights: { rating: 0.1, distance: 0.9 },
    });
    expect(sorted[0].id).toBe('B');
  });

  it('computeProviderScore retorna 0..1 e usa default quando weights ausente', () => {
    const s = computeProviderScore({ rating: 5, distanceKm: 0 });
    expect(s).toBeGreaterThan(0.99);
    const z = computeProviderScore({ rating: 0, distanceKm: 100 });
    expect(z).toBe(0);
    expect(DEFAULT_SCORE_WEIGHTS).toEqual({ rating: 0.7, distance: 0.3 });
  });

  it('ausência de distância (sem GPS) ainda permite ordenar — distância vira 0', () => {
    const list = [p('A', 4.0, NaN as unknown as number), p('B', 4.8, NaN as unknown as number)];
    list[0].distanceKm = undefined;
    list[1].distanceKm = undefined;
    const sorted = applySearchFilters(list, { sortBy: 'best' });
    expect(sorted[0].id).toBe('B');
  });
});
