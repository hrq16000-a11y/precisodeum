import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProviderCard from '@/components/ProviderCard';
import type { DbProvider } from '@/hooks/useProviders';

vi.mock('@/hooks/useSiteSettings', () => ({
  useFeatureEnabled: () => false,
  useSettingValue: () => 'adventurer',
}));
vi.mock('@/hooks/useGeoCity', () => ({ useGeoCity: () => ({ city: 'São José dos Pinhais', state: 'PR' }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/useOnlinePresence', () => ({ useIsProviderOnline: () => false }));
vi.mock('@/hooks/useProviderActivity', () => ({ useProviderActivity: () => ({ data: null }) }));
vi.mock('@/hooks/useEngagementPoints', () => ({ useEngagementPoints: () => ({ data: 0 }) }));
vi.mock('@/hooks/useTopProfessional', () => ({ useTopProfessional: () => false }));
vi.mock('@/hooks/useCardImpression', () => ({ useCardImpression: () => null }));
vi.mock('@/hooks/usePrefetch', () => ({ usePrefetchProvider: () => vi.fn(), usePrefetchHandlers: () => ({}) }));
vi.mock('@/lib/tracking', () => ({ trackWhatsAppClick: vi.fn(), trackProfileClick: vi.fn() }));
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

const provider: DbProvider = {
  id: '1',
  userId: 'u1',
  name: 'Maria Silva',
  businessName: undefined,
  category: 'Babá',
  categorySlug: 'baba',
  categoryIcon: 'Baby',
  city: 'Fazenda Rio Grande',
  state: 'PR',
  neighborhood: 'Nações',
  latitude: -25.532,
  longitude: -49.172,
  rating: 5,
  reviewCount: 0,
  photo: '',
  description: 'Cuidadora',
  phone: '',
  whatsapp: '41999999999',
  yearsExperience: 3,
  
  slug: 'maria-silva',
  featured: true,
  servicesCount: 1,
  portfolioAlbumCount: 0,
  portfolioPhotoCount: 0,
  distanceKm: 20.3,
  _distanceAudit: {
    distanceKm: 20.3,
    source: 'city-center',
    suspicious: true,
    rawDirectKm: 0.8,
    cityCenterKm: 20.3,
    providerCity: 'Fazenda Rio Grande',
    userCity: 'São José dos Pinhais',
    cityToCityKm: 20.3,
    providerToOwnCenterKm: 21.1,
  },
};

describe('ProviderCard — auditoria de distância', () => {
  it('não exibe selo de super perto nem de bairro quando a distância auditada é suspeita', () => {
    render(
      <BrowserRouter>
        <ProviderCard provider={provider} />
      </BrowserRouter>,
    );

    expect(screen.queryByText(/super perto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/atende agora no seu bairro/i)).not.toBeInTheDocument();
    expect(screen.getByText(/distância estimada pela cidade declarada/i)).toBeInTheDocument();
  });
});