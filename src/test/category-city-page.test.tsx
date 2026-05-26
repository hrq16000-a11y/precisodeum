/**
 * Testes do CategoryCityPage — renderização, CTAs e fallback noindex.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const useCategoryProvidersMock = vi.fn();
vi.mock('@/hooks/useProviders', () => ({
  useCategoryProviders: (...a: any[]) => useCategoryProvidersMock(...a),
}));
vi.mock('@/hooks/useSeoHead', () => ({
  useSeoHead: vi.fn(),
  SITE_BASE_URL: 'https://precisodeum.com.br',
}));
vi.mock('@/hooks/useJsonLd', () => ({ useJsonLd: vi.fn() }));
vi.mock('@/lib/citiesIndex', () => ({ isKnownCity: (c: string) => c === 'Curitiba' }));
vi.mock('@/components/Header', () => ({ default: () => <header /> }));
vi.mock('@/components/Footer', () => ({ default: () => <footer /> }));
vi.mock('@/components/Breadcrumbs', () => ({ default: () => <nav data-testid="breadcrumbs" /> }));
vi.mock('@/components/ProviderCard', () => ({
  default: ({ provider }: any) => <div data-testid="provider-card">{provider.full_name}</div>,
}));
vi.mock('@/components/EmptyStateFallback', () => ({
  default: ({ title }: any) => <div data-testid="empty-state">{title}</div>,
}));

import CategoryCityPage from '@/pages/CategoryCityPage';

function renderAt(path: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { HelmetProvider } = require('react-helmet-async');
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/categoria/:slug/em/:cidade" element={<CategoryCityPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('CategoryCityPage', () => {
  it('renders providers filtered by city + CTAs to /buscar and /profissional', () => {
    useCategoryProvidersMock.mockReturnValue({
      data: {
        category: { slug: 'eletricista', name: 'Eletricista' },
        providers: [
          { id: 'p1', slug: 'joao', full_name: 'João', city: 'Curitiba' },
          { id: 'p2', slug: 'maria', full_name: 'Maria', city: 'Curitiba' },
          { id: 'p3', slug: 'jose', full_name: 'José', city: 'Outra' },
        ],
      },
      isLoading: false,
    });
    renderAt('/categoria/eletricista/em/curitiba');

    // Apenas 2 providers da cidade aparecem.
    expect(screen.getAllByTestId('provider-card')).toHaveLength(2);
    // CTA "Ver perfil" para cada um.
    expect(screen.getAllByTestId('provider-cta')).toHaveLength(2);
    // CTAs canônicos para /buscar e categoria/cidade.
    expect(screen.getByTestId('cta-search-here')).toBeInTheDocument();
    expect(screen.getByTestId('cta-search-broad')).toBeInTheDocument();
    expect(screen.getByTestId('cta-category-list')).toBeInTheDocument();
    expect(screen.getByTestId('cta-city-page')).toBeInTheDocument();
    // H1 contém categoria e cidade.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Eletricista/);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Curitiba/);
  });

  it('shows EmptyState fallback when category is missing', () => {
    useCategoryProvidersMock.mockReturnValue({ data: { category: null, providers: [] }, isLoading: false });
    renderAt('/categoria/inexistente/em/curitiba');
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows "no providers" CTA when city is valid but list is empty', () => {
    useCategoryProvidersMock.mockReturnValue({
      data: {
        category: { slug: 'eletricista', name: 'Eletricista' },
        providers: [{ id: 'p1', full_name: 'X', city: 'Outra' }],
      },
      isLoading: false,
    });
    renderAt('/categoria/eletricista/em/curitiba');
    expect(screen.queryByTestId('provider-card')).toBeNull();
    expect(screen.getByText(/Nenhum profissional/i)).toBeInTheDocument();
  });
});
