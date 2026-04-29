import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProviderCard from '@/components/ProviderCard';
import type { DbProvider } from '@/hooks/useProviders';

vi.mock('@/hooks/useSiteSettings', () => ({
  useFeatureEnabled: () => false,
  useSettingValue: () => 'adventurer',
}));
vi.mock('@/hooks/useGeoCity', () => ({ useGeoCity: () => ({ city: 'Curitiba', state: 'PR' }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/useOnlinePresence', () => ({
  useIsProviderOnline: () => false,
  useProviderPresence: () => null,
  useProviderLastSeen: () => null,
  useLastPresenceSync: () => 0,
  useRealtimeHealth: () => 'healthy',
  useOnlineProviders: () => new Set<string>(),
  useRecentlyOfflineSet: () => new Set<string>(),
  useIsRecentlyOffline: () => false,
  RECENTLY_OFFLINE_WINDOW_MS: 600000,
}));
vi.mock('@/hooks/useProviderActivity', () => ({ useProviderActivity: () => ({ data: null }) }));
vi.mock('@/hooks/useEngagementPoints', () => ({ useEngagementPoints: () => ({ data: 0 }) }));
vi.mock('@/hooks/useTopProfessional', () => ({ useTopProfessional: () => false }));
vi.mock('@/hooks/useCardImpression', () => ({ useCardImpression: () => null }));
vi.mock('@/hooks/usePrefetch', () => ({ usePrefetchProvider: () => vi.fn(), usePrefetchHandlers: () => ({}) }));
vi.mock('@/lib/tracking', () => ({
  trackWhatsAppClick: vi.fn(),
  trackProfileClick: vi.fn(),
  trackGeoEvent: vi.fn(),
}));
vi.mock('@/components/FavoriteButton', () => ({ default: () => <button type="button">fav</button> }));
vi.mock('@/components/ProfileBadge', () => ({ default: () => <span>perfil</span> }));
vi.mock('@/components/CommunityVerifiedBadge', () => ({ default: () => <span>verificado</span> }));
vi.mock('@/components/TopProfessionalBadge', () => ({ default: () => <span>top</span> }));
vi.mock('@/components/ReviewSummary', () => ({ getRankTier: () => null }));
vi.mock('@/components/StarRating', () => ({ default: () => null }));
vi.mock('@/components/CategoryIcon', () => ({ default: () => <span>icon</span> }));
vi.mock('@/lib/imageResolver', () => ({ handleImageError: vi.fn(), getOptimizedUrl: (v: string) => v }));
vi.mock('@/lib/imageOptimizer', () => ({ responsiveImageSrcSet: () => '' }));
vi.mock('@/lib/whatsapp', () => ({ whatsappLink: () => '#', buildSmartMessage: () => 'oi' }));
vi.mock('@/lib/providerDisplay', async () => {
  const actual = await vi.importActual<typeof import('@/lib/providerDisplay')>('@/lib/providerDisplay');
  return actual;
});

const baseProvider: DbProvider = {
  id: 'p1',
  userId: 'u1',
  name: 'João Silva',
  businessName: undefined,
  category: 'Eletricista',
  categorySlug: 'eletricista',
  categoryIcon: 'Zap',
  city: 'Curitiba',
  state: 'PR',
  neighborhood: 'Centro',
  latitude: null,
  longitude: null,
  rating: 5,
  reviewCount: 0,
  photo: '',
  description: '',
  phone: '',
  whatsapp: '41999999999',
  yearsExperience: 1,
  slug: 'joao-silva',
  featured: false,
  servicesCount: 1,
  portfolioAlbumCount: 0,
  portfolioPhotoCount: 0,
};

describe('ProviderCard — distância inválida (Infinity/NaN)', () => {
  const renderCard = (provider: DbProvider) => {
    return render(
      <BrowserRouter>
        <ProviderCard provider={provider} />
      </BrowserRouter>,
    );
  };

  it('NÃO renderiza "Infinity km" quando distanceKm = Infinity', () => {
    renderCard({ ...baseProvider, distanceKm: Infinity as unknown as number });
    expect(screen.queryByText(/Infinity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinitymin/i)).not.toBeInTheDocument();
  });

  it('NÃO renderiza "NaN km" quando distanceKm = NaN', () => {
    renderCard({ ...baseProvider, distanceKm: Number.NaN });
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
  });

  it('NÃO renderiza distância quando audit.distanceKm = Infinity', () => {
    renderCard({
      ...baseProvider,
      distanceKm: undefined,
      _distanceAudit: {
        distanceKm: Infinity,
        source: 'unavailable',
        suspicious: false,
        rawDirectKm: null,
        cityCenterKm: null,
        providerCity: 'Curitiba',
        userCity: 'Curitiba',
        cityToCityKm: null,
        providerToOwnCenterKm: null,
      },
    });
    expect(screen.queryByText(/Infinity/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('distance-unavailable')).toBeInTheDocument();
  });

  it('mostra placeholder "Distância indisponível" quando há audit mas sem coords válidas', () => {
    renderCard({
      ...baseProvider,
      distanceKm: undefined,
      _distanceAudit: {
        distanceKm: Number.NaN,
        source: 'unavailable',
        suspicious: false,
        rawDirectKm: null,
        cityCenterKm: null,
        providerCity: 'Curitiba',
        userCity: 'Curitiba',
        cityToCityKm: null,
        providerToOwnCenterKm: null,
      },
    });
    expect(screen.getByText(/distância indisponível/i)).toBeInTheDocument();
  });

  it('renderiza distância normalmente quando finita', () => {
    renderCard({
      ...baseProvider,
      distanceKm: 3.4,
      _distanceAudit: {
        distanceKm: 3.4,
        source: 'direct',
        suspicious: false,
        rawDirectKm: 3.4,
        cityCenterKm: null,
        providerCity: 'Curitiba',
        userCity: 'Curitiba',
        cityToCityKm: null,
        providerToOwnCenterKm: null,
      },
    });
    expect(screen.getByText(/3\.4 km/i)).toBeInTheDocument();
    expect(screen.queryByTestId('distance-unavailable')).not.toBeInTheDocument();
  });
});
