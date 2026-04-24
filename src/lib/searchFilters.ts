/**
 * Lógica pura de filtros do /buscar — extraída para permitir testes unitários
 * sem depender do React/router/supabase.
 */
import { calculateDistanceKm } from '@/lib/geoDistance';

export type SortMode = 'relevance' | 'nearest' | 'rating' | 'reviews' | 'name_asc' | 'name_desc' | 'experience';
export type FeaturedFilter = 'all' | 'featured' | 'normal';

export interface FilterableProvider {
  id: string;
  userId: string;
  name: string;
  businessName?: string;
  neighborhood: string;
  phone: string;
  whatsapp: string;
  featured: boolean;
  rating: number;
  reviewCount: number;
  yearsExperience: number;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number;
}

export interface RouteCorridor {
  midLat: number;
  midLon: number;
  isInside: (lat: number, lon: number) => boolean;
}

export interface SearchFilterOptions {
  selectedNeighborhood?: string;
  businessNameFilter?: string;
  phoneFilter?: string;
  featuredFilter?: FeaturedFilter;
  onlineOnly?: boolean;
  acceptingOnly?: boolean;
  sortBy?: SortMode;
  urgencyMode?: boolean;
  onlineSet?: Set<string>;
  routeCorridor?: RouteCorridor | null;
}

export function applySearchFilters<T extends FilterableProvider>(
  list: T[],
  opts: SearchFilterOptions = {}
): T[] {
  const {
    selectedNeighborhood = '',
    businessNameFilter = '',
    phoneFilter = '',
    featuredFilter = 'all',
    onlineOnly = false,
    acceptingOnly = false,
    sortBy = 'relevance',
    urgencyMode = false,
    onlineSet = new Set<string>(),
    routeCorridor = null,
  } = opts;

  let results = [...list];

  if (selectedNeighborhood) {
    const nb = selectedNeighborhood.toLowerCase();
    results = results.filter((p) => p.neighborhood.toLowerCase().includes(nb));
  }
  if (businessNameFilter) {
    const bn = businessNameFilter.toLowerCase();
    results = results.filter(
      (p) => p.businessName?.toLowerCase().includes(bn) || p.name.toLowerCase().includes(bn)
    );
  }
  if (phoneFilter) {
    const ph = phoneFilter.replace(/\D/g, '');
    if (ph) results = results.filter((p) => p.phone.includes(ph) || p.whatsapp.includes(ph));
  }
  if (featuredFilter === 'featured') results = results.filter((p) => p.featured);
  else if (featuredFilter === 'normal') results = results.filter((p) => !p.featured);

  if (onlineOnly) results = results.filter((p) => onlineSet.has(p.userId));
  if (acceptingOnly) {
    results = results.filter((p) => !!p.whatsapp && p.whatsapp.trim().length > 0);
  }

  if (sortBy === 'nearest') {
    results.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  } else if (sortBy !== 'relevance') {
    results.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return b.rating - a.rating;
        case 'reviews': return b.reviewCount - a.reviewCount;
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'experience': return b.yearsExperience - a.yearsExperience;
        default: return 0;
      }
    });
  }

  if (routeCorridor) {
    results = results.filter((p) => {
      if (p.latitude == null || p.longitude == null) return false;
      return routeCorridor.isInside(p.latitude, p.longitude);
    });
    results.sort((a, b) => {
      const dA = calculateDistanceKm(
        { latitude: routeCorridor.midLat, longitude: routeCorridor.midLon },
        { latitude: a.latitude!, longitude: a.longitude! }
      );
      const dB = calculateDistanceKm(
        { latitude: routeCorridor.midLat, longitude: routeCorridor.midLon },
        { latitude: b.latitude!, longitude: b.longitude! }
      );
      return dA - dB;
    });
  }

  if (urgencyMode && onlineSet.size > 0) {
    results = [
      ...results.filter((p) => onlineSet.has(p.userId)),
      ...results.filter((p) => !onlineSet.has(p.userId)),
    ];
  }

  return results;
}

/**
 * Conta quantos filtros estão ativos. Usado pelo badge na UI.
 */
export function countActiveFilters(state: {
  selectedCategory?: string;
  selectedNeighborhood?: string;
  businessNameFilter?: string;
  phoneFilter?: string;
  featuredFilter?: FeaturedFilter;
  minRating?: number;
  onlineOnly?: boolean;
  acceptingOnly?: boolean;
}): number {
  return [
    state.selectedCategory,
    state.selectedNeighborhood,
    state.businessNameFilter,
    state.phoneFilter,
    state.featuredFilter && state.featuredFilter !== 'all' ? 'x' : '',
    (state.minRating ?? 0) > 0 ? 'x' : '',
    state.onlineOnly ? 'x' : '',
    state.acceptingOnly ? 'x' : '',
  ].filter(Boolean).length;
}

export const initialFilterState = {
  selectedCategory: '',
  selectedCity: '',
  selectedNeighborhood: '',
  businessNameFilter: '',
  phoneFilter: '',
  statusFilter: 'all' as const,
  featuredFilter: 'all' as FeaturedFilter,
  minRating: 0,
  sortBy: 'relevance' as SortMode,
  onlineOnly: false,
  acceptingOnly: false,
};
