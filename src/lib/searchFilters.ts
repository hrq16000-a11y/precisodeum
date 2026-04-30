/**
 * Lógica pura de filtros do /buscar — extraída para permitir testes unitários
 * sem depender do React/router/supabase.
 */
import { calculateDistanceKm } from '@/lib/geoDistance';

export type SortMode = 'relevance' | 'best' | 'nearest' | 'rating' | 'reviews' | 'name_asc' | 'name_desc' | 'experience';

/**
 * Pesos do score híbrido usado pelo modo `'best'`. Soma livre — normalizada
 * internamente. Valores padrão privilegiam **rating** com **distância como
 * desempate**, conforme a regra de negócio (anti-leilão de preços).
 */
export interface SearchScoreWeights {
  rating: number;
  distance: number;
}
export const DEFAULT_SCORE_WEIGHTS: SearchScoreWeights = { rating: 0.7, distance: 0.3 };

/** Normaliza distância km → score 0..1 (≤0km=1, ≥50km=0, linear). */
function distanceScore(distanceKm: number | null | undefined): number {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return 0;
  if (distanceKm <= 0) return 1;
  if (distanceKm >= 50) return 0;
  return 1 - distanceKm / 50;
}

/** Normaliza rating 0..5 → 0..1. */
function ratingScore(rating: number): number {
  return Math.max(0, Math.min(1, (rating || 0) / 5));
}

/**
 * Score híbrido (0..1). Rating tem prioridade; distância funciona como
 * desempate quando dois prestadores têm avaliações próximas.
 */
export function computeProviderScore(
  p: { rating: number; distanceKm?: number | null },
  weights: SearchScoreWeights = DEFAULT_SCORE_WEIGHTS,
): number {
  const wr = Math.max(0, weights.rating);
  const wd = Math.max(0, weights.distance);
  const total = wr + wd || 1;
  return (ratingScore(p.rating) * wr + distanceScore(p.distanceKm) * wd) / total;
}

export type FeaturedFilter = 'all' | 'featured' | 'normal';
/**
 * Status filter:
 *  - 'all': no status restriction (online still gets a stable boost to the top)
 *  - 'online_first': same as 'all' (kept explicit for UI clarity)
 *  - 'online_only': keep only providers currently online
 *  - 'recently_offline': keep only providers that went offline within the recent window
 */
export type StatusFilter = 'all' | 'online_first' | 'online_only' | 'recently_offline';

/**
 * Janela de disponibilidade que o usuário pode escolher na UI:
 *  - 'any': sem restrição
 *  - 'today': profissional ativo hoje (online agora ou houve heartbeat hoje)
 *  - 'this_week': ativo hoje OU offline há pouco tempo (recentlyOfflineSet)
 *  - 'recent': ativo recentemente (online ou recently offline) — alias mais brando de this_week
 *
 * É um açúcar para os flags low-level (`activeTodayOnly`, `statusFilter='online_only'`,
 * `recently_offline`) e fica persistido em `?disponivel=` na URL.
 */
export type AvailabilityWindow = 'any' | 'today' | 'this_week' | 'recent';

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
  activeTodayOnly?: boolean;
  sortBy?: SortMode;
  urgencyMode?: boolean;
  onlineSet?: Set<string>;
  activeTodaySet?: Set<string>;
  /** Users who went offline recently (within the configured window). Used by status filter. */
  recentlyOfflineSet?: Set<string>;
  /** Status filter — see StatusFilter type for behavior */
  statusFilter?: StatusFilter;
  routeCorridor?: RouteCorridor | null;
  /** When false (default), online providers are pulled to the top after sorting (stable partition). */
  disableOnlineBoost?: boolean;
  /**
   * Açúcar para combinar `activeTodaySet`/`onlineSet`/`recentlyOfflineSet`.
   * - 'today': mantém apenas online agora OU activeToday
   * - 'this_week' / 'recent': online OR activeToday OR recentlyOffline
   * - 'any' (padrão): não filtra
   */
  availabilityWindow?: AvailabilityWindow;
  /** Pesos do modo `sortBy='best'`. Default: rating 0.7 / distância 0.3. */
  scoreWeights?: SearchScoreWeights;
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
    activeTodayOnly = false,
    sortBy = 'relevance',
    urgencyMode = false,
    onlineSet = new Set<string>(),
    activeTodaySet = new Set<string>(),
    recentlyOfflineSet = new Set<string>(),
    statusFilter = 'all',
    routeCorridor = null,
    disableOnlineBoost = false,
    availabilityWindow = 'any',
    scoreWeights = DEFAULT_SCORE_WEIGHTS,
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

  // Status filter (UI: "Online primeiro" / "Apenas Online" / "Recentemente Offline")
  if (statusFilter === 'online_only') {
    results = results.filter((p) => onlineSet.has(p.userId));
  } else if (statusFilter === 'recently_offline') {
    results = results.filter((p) => recentlyOfflineSet.has(p.userId));
  }

  if (activeTodayOnly) {
    // "Ativo hoje" inclui quem está online agora também,
    // E só vale para profissionais a até 5km do usuário (mesma régua do mapa).
    results = results.filter((p) => {
      const isActive = activeTodaySet.has(p.userId) || onlineSet.has(p.userId);
      if (!isActive) return false;
      // Sem distância calculada (sem GPS) → mantém para não esvaziar
      if (p.distanceKm == null) return true;
      return p.distanceKm < 5;
    });
    // Prioriza ATIVO + MAIS PERTO no topo (mesmo em sort 'relevance')
    results.sort((a, b) => {
      const aOnline = onlineSet.has(a.userId) ? 0 : 1;
      const bOnline = onlineSet.has(b.userId) ? 0 : 1;
      if (aOnline !== bOnline) return aOnline - bOnline;
      const aActive = activeTodaySet.has(a.userId) ? 0 : 1;
      const bActive = activeTodaySet.has(b.userId) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
    });
  }
  if (acceptingOnly) {
    results = results.filter((p) => !!p.whatsapp && p.whatsapp.trim().length > 0);
  }

  // Janela de disponibilidade — açúcar das listas online/activeToday/recentlyOffline.
  if (availabilityWindow === 'today') {
    results = results.filter(
      (p) => onlineSet.has(p.userId) || activeTodaySet.has(p.userId)
    );
  } else if (availabilityWindow === 'this_week' || availabilityWindow === 'recent') {
    results = results.filter(
      (p) =>
        onlineSet.has(p.userId) ||
        activeTodaySet.has(p.userId) ||
        recentlyOfflineSet.has(p.userId)
    );
  }

  if (sortBy === 'nearest') {
    results.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  } else if (sortBy === 'best') {
    // Score híbrido (rating prioritário, distância como desempate). Em empate
    // de score, mantém ordem por rating desc, depois reviews desc.
    results.sort((a, b) => {
      const sb = computeProviderScore(b, scoreWeights);
      const sa = computeProviderScore(a, scoreWeights);
      if (sb !== sa) return sb - sa;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.reviewCount - a.reviewCount;
    });
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

  // Online-first stable partition: profissionais online sobem ao topo
  // dentro do conjunto atual, preservando a ordem produzida pelo sort.
  // Aplica-se em qualquer modo (busca, lista, grid), salvo opt-out explícito.
  if (!disableOnlineBoost && onlineSet.size > 0) {
    results = [
      ...results.filter((p) => onlineSet.has(p.userId)),
      ...results.filter((p) => !onlineSet.has(p.userId)),
    ];
  } else if (urgencyMode && onlineSet.size > 0) {
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
  activeTodayOnly?: boolean;
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
    state.activeTodayOnly ? 'x' : '',
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
