import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Index from '@/pages/Index';

vi.mock('@/hooks/useSeoHead', () => ({
  SITE_BASE_URL: 'https://precisodeum.com.br',
  useSeoHead: vi.fn(),
}));

vi.mock('@/hooks/useJsonLd', () => ({ useJsonLd: vi.fn() }));

vi.mock('@/hooks/useGeoCity', () => ({
  useGeoCity: () => ({ city: 'São Paulo', state: 'SP', latitude: -23.55, longitude: -46.63 }),
}));

vi.mock('@/hooks/useHomeFeatureFlags', () => ({
  useHomeFeatureFlags: () => ({
    reviewsEnabled: false,
    featuredEnabled: true,
    popularSearchesEnabled: false,
    faqEnabled: false,
    blogEnabled: false,
    jobsEnabled: false,
    howItWorksEnabled: false,
    ctaEnabled: false,
    citiesEnabled: false,
    sponsorsEnabled: false,
    heroBannersEnabled: false,
    sectionsOrderRaw: 'categories',
    hiddenSectionsRaw: '',
  }),
}));

vi.mock('@/hooks/useProviders', () => ({
  useCategoriesWithCount: () => ({ data: [{ id: 'cat-1', name: 'Eletricista', slug: 'eletricista', count: 3 }], isLoading: false }),
  useFeaturedProviders: () => ({
    data: [],
    isLoading: true,
    isFetching: false,
    isError: false,
    dataUpdatedAt: 0,
  }),
}));

vi.mock('@/components/Header', () => ({ default: () => <header data-testid="home-header" /> }));
vi.mock('@/components/home/HeroBanner', () => ({ default: () => <section data-testid="home-hero" /> }));
vi.mock('@/components/home/CategoriesGrid', () => ({ default: () => <section data-testid="home-categories" /> }));
vi.mock('@/components/Footer', () => ({ default: () => <footer data-testid="home-footer" /> }));
vi.mock('@/components/home/FeaturedProviders', () => ({
  default: ({ isLoading }: { isLoading: boolean }) => (
    <section aria-label="Profissionais em Destaque" data-loading={String(isLoading)}>
      <h2>Profissionais em Destaque</h2>
    </section>
  ),
}));

describe('Home — regressão da seção Profissionais em Destaque', () => {
  it('mantém o slot da seção visível na home mesmo durante o carregamento pós-LCP', async () => {
    render(
      <BrowserRouter>
        <Index />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /profissionais em destaque/i })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/profissionais em destaque/i)).toHaveAttribute('data-loading', 'true');
    expect(screen.getByTestId('home-categories')).toBeInTheDocument();
  });
});