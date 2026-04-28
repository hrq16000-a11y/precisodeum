import { describe, expect, it } from 'vitest';
import { filterAndRankProvidersGrouped } from '@/hooks/useProviders';
import type { DbProvider } from '@/hooks/useProviders';

const make = (over: Partial<DbProvider>): DbProvider => ({
  id: over.id || Math.random().toString(36),
  userId: 'u-' + (over.id || 'x'),
  name: over.name || 'Pro',
  businessName: undefined,
  category: 'Eletricista',
  categorySlug: 'eletricista',
  categoryIcon: 'Zap',
  city: over.city || 'Curitiba',
  state: 'PR',
  neighborhood: '',
  latitude: over.latitude ?? null,
  longitude: over.longitude ?? null,
  rating: 5,
  reviewCount: 1,
  photo: '',
  description: '',
  phone: '',
  whatsapp: '',
  yearsExperience: 1,
  slug: 'pro-' + (over.id || 'x'),
  featured: false,
  servicesCount: 1,
  portfolioAlbumCount: 0,
  portfolioPhotoCount: 0,
  ...over,
});

describe('useProviders — invariante nearest (distância não-finita)', () => {
  it('providers sem coords NÃO ficam à frente de providers com coords válidas', () => {
    const providers: DbProvider[] = [
      make({ id: 'no-coords', name: 'Sem Coords', latitude: null, longitude: null }),
      make({ id: 'far', name: 'Longe', latitude: -25.9, longitude: -49.5 }),
      make({ id: 'near', name: 'Perto', latitude: -25.43, longitude: -49.27 }),
    ];

    const userLat = -25.43;
    const userLon = -49.27;

    const result = filterAndRankProvidersGrouped(
      providers,
      '',
      'Curitiba',
      'eletricista',
      0,
      'PR',
      userLat,
      userLon,
      50,
    );

    const order = [...result.local, ...result.nearby, ...result.outOfState].map((p) => p.id);
    const idxNoCoords = order.indexOf('no-coords');
    const idxNear = order.indexOf('near');
    expect(idxNear).toBeGreaterThanOrEqual(0);
    // O sem-coords vai pro fim quando houver candidatos com distância finita
    if (idxNoCoords >= 0) {
      expect(idxNear).toBeLessThan(idxNoCoords);
    }
  });

  it('NÃO emite distanceKm = Infinity nos providers retornados (vira undefined)', () => {
    const providers: DbProvider[] = [
      make({ id: 'a', latitude: null, longitude: null }),
      make({ id: 'b', latitude: -25.43, longitude: -49.27 }),
    ];
    const result = filterAndRankProvidersGrouped(
      providers, '', 'Curitiba', 'eletricista', 0, 'PR', -25.43, -49.27, 50,
    );
    const all = [...result.local, ...result.nearby, ...result.outOfState];
    for (const p of all) {
      // distanceKm sempre é undefined ou número finito — nunca Infinity/NaN
      if (p.distanceKm !== undefined) {
        expect(Number.isFinite(p.distanceKm)).toBe(true);
      }
    }
  });

  it('é estável: mesma entrada produz mesma ordem', () => {
    const providers: DbProvider[] = [
      make({ id: 'a', latitude: -25.43, longitude: -49.27 }),
      make({ id: 'b', latitude: -25.44, longitude: -49.28 }),
      make({ id: 'c', latitude: null, longitude: null }),
    ];
    const r1 = filterAndRankProvidersGrouped(providers, '', 'Curitiba', 'eletricista', 0, 'PR', -25.43, -49.27, 50);
    const r2 = filterAndRankProvidersGrouped(providers, '', 'Curitiba', 'eletricista', 0, 'PR', -25.43, -49.27, 50);
    const ids1 = [...r1.local, ...r1.nearby, ...r1.outOfState].map((p) => p.id);
    const ids2 = [...r2.local, ...r2.nearby, ...r2.outOfState].map((p) => p.id);
    expect(ids1).toEqual(ids2);
  });
});
