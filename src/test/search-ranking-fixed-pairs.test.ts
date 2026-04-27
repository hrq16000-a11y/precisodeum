import { describe, expect, it } from 'vitest';
import { filterAndRankProvidersGrouped, type DbProvider } from '@/hooks/useProviders';

const baseProvider = (overrides: Partial<DbProvider>): DbProvider => ({
  id: 'provider',
  userId: 'user',
  name: 'Maria Silva',
  businessName: undefined,
  category: 'Babá',
  categorySlug: 'baba',
  categoryIcon: 'Baby',
  city: 'São José dos Pinhais',
  state: 'PR',
  neighborhood: 'Centro',
  latitude: -25.53,
  longitude: -49.17,
  rating: 5,
  reviewCount: 10,
  photo: '',
  description: 'Babá e cuidadora infantil',
  phone: '',
  whatsapp: '41999999999',
  yearsExperience: 4,
  
  slug: 'maria-silva',
  featured: true,
  servicesCount: 2,
  portfolioAlbumCount: 0,
  portfolioPhotoCount: 0,
  ...overrides,
});

describe('ranking fixo — São José dos Pinhais × Fazenda Rio Grande', () => {
  it('prioriza match forte na cidade do usuário e corrige distância suspeita de Fazenda Rio Grande', () => {
    const providers: DbProvider[] = [
      baseProvider({
        id: 'sjp-baba',
        userId: 'u1',
        slug: 'sjp-baba',
        city: 'São José dos Pinhais',
        latitude: -25.531,
        longitude: -49.171,
      }),
      baseProvider({
        id: 'fgr-baba-suspeita',
        userId: 'u2',
        slug: 'fgr-baba-suspeita',
        city: 'Fazenda Rio Grande',
        latitude: -25.532,
        longitude: -49.172,
      }),
      baseProvider({
        id: 'fgr-pedreiro',
        userId: 'u3',
        slug: 'fgr-pedreiro',
        category: 'Pedreiro',
        categorySlug: 'pedreiro',
        description: 'Construção e alvenaria',
        city: 'Fazenda Rio Grande',
        latitude: -25.652,
        longitude: -49.307,
      }),
    ];

    const grouped = filterAndRankProvidersGrouped(
      providers,
      'baba',
      'São José dos Pinhais',
      '',
      0,
      'PR',
      -25.53,
      -49.17,
      30,
    );

    const ordered = [...grouped.local, ...grouped.nearby, ...grouped.outOfState];
    expect(ordered.map((provider) => provider.id)).toContain('sjp-baba');
    expect(ordered.map((provider) => provider.id)).toContain('fgr-baba-suspeita');
    expect(ordered.findIndex((provider) => provider.id === 'sjp-baba')).toBeLessThan(
      ordered.findIndex((provider) => provider.id === 'fgr-baba-suspeita')
    );
    expect(ordered.filter((provider) => provider.categorySlug === 'baba').map((provider) => provider.id)).toEqual([
      'sjp-baba',
      'fgr-baba-suspeita',
    ]);

    const corrected = ordered.find((provider) => provider.id === 'fgr-baba-suspeita');
    expect(corrected).toBeTruthy();
    expect(corrected?._distanceAudit?.source).toBe('city-center');
    expect(corrected?._distanceAudit?.suspicious).toBe(true);
    expect(corrected?.distanceKm ?? 0).toBeGreaterThan(8);
  });
});