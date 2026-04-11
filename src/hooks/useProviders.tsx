import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { avatarThumb, serviceImageThumb } from '@/lib/imageOptimizer';
import { normalize } from '@/lib/normalize';
import GeoEngine from '@/lib/geoEngine';
import type { GeoIntent } from '@/lib/geoEngine';
import SearchIntelligence from '@/lib/searchIntelligence';
import { sanitizeSearchTokens } from '@/lib/searchSanitizer';

/** Track impression for fairness system — fire-and-forget */
export function trackProviderImpressions(providerIds: string[]) {
  if (!providerIds.length) return;
  // Batch via RPC — one call per provider (lightweight)
  providerIds.forEach(id => {
    supabase.rpc('increment_provider_impression', { _provider_id: id }).then(() => {});
  });
}

export interface DbProvider {
  id: string;
  userId: string;
  name: string;
  businessName?: string;
  category: string;
  categorySlug: string;
  categoryIcon: string;
  city: string;
  state: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  reviewCount: number;
  photo: string;
  serviceImage?: string;
  hasPortfolio?: boolean;
  description: string;
  phone: string;
  whatsapp: string;
  yearsExperience: number;
  plan: string;
  slug: string;
  featured: boolean;
  servicesCount: number;
  portfolioAlbumCount: number;
  portfolioPhotoCount: number;
}

interface ServiceFallback {
  serviceName?: string;
  serviceDescription?: string;
  serviceWhatsapp?: string;
  serviceArea?: string;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickFeaturedCount(total: number): number {
  if (total <= 3) return total;
  const min = 3;
  const max = Math.min(5, total);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function mapProvider(p: any, profileName?: string, serviceImage?: string, hasPortfolio?: boolean, serviceFallback?: ServiceFallback): DbProvider {
  const catName = (p.categories as any)?.name || '';
  const provCity = p.city?.trim() || '';
  const provState = p.state?.trim() || '';
  const provNeighborhood = p.neighborhood?.trim() || '';
  const provDescription = p.description?.trim() || '';
  const provWhatsapp = p.whatsapp?.trim() || '';
  const provPhone = p.phone?.trim() || '';

  const effectiveWhatsapp = provWhatsapp || provPhone || serviceFallback?.serviceWhatsapp || '';
  const effectivePhone = provPhone || provWhatsapp || serviceFallback?.serviceWhatsapp || '';

  return {
    userId: p.user_id,
    id: p.id,
    name: profileName || p.business_name || serviceFallback?.serviceName || 'Profissional',
    businessName: p.business_name || undefined,
    category: catName || serviceFallback?.serviceName || '',
    categorySlug: (p.categories as any)?.slug || '',
    categoryIcon: (p.categories as any)?.icon || '🔧',
    city: provCity,
    state: provState,
    neighborhood: provNeighborhood,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    rating: Number(p.rating_avg) || 0,
    reviewCount: p.review_count || 0,
    photo: p.photo_url || '',
    serviceImage: serviceImage || undefined,
    hasPortfolio: hasPortfolio || false,
    description: provDescription || serviceFallback?.serviceDescription || '',
    phone: effectivePhone,
    whatsapp: effectiveWhatsapp,
    yearsExperience: p.years_experience,
    plan: p.plan,
    slug: p.slug || p.id,
    featured: p.featured,
    servicesCount: p.services_count || 0,
    portfolioAlbumCount: p.portfolio_album_count || 0,
    portfolioPhotoCount: p.portfolio_photo_count || 0,
  };
}

const providerSelect = 'id, user_id, business_name, description, photo_url, city, state, neighborhood, latitude, longitude, phone, whatsapp, years_experience, plan, slug, featured, rating_avg, review_count, status, category_id, portfolio_photo_count, portfolio_album_count, services_count, categories(name, slug, icon)';

// --- Ranking config cache ---
let _rankingConfig: { boostMul: number; fairnessPen: number; randomMax: number } | null = null;
let _rankingConfigTime = 0;

async function getRankingConfig() {
  const now = Date.now();
  if (_rankingConfig && now - _rankingConfigTime < 5 * 60_000) return _rankingConfig;
  const { data } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['ranking_boost_multiplier', 'ranking_fairness_penalty', 'ranking_random_factor']);
  const map: Record<string, string> = {};
  (data || []).forEach((s: any) => { map[s.key] = s.value; });
  _rankingConfig = {
    boostMul: Number(map['ranking_boost_multiplier']) || 20,
    fairnessPen: Number(map['ranking_fairness_penalty']) || 5,
    randomMax: Number(map['ranking_random_factor']) || 5,
  };
  _rankingConfigTime = now;
  return _rankingConfig;
}

/**
 * Lightweight fetch — uses counter columns + boost/impressions for hybrid ranking.
 */
async function fetchProvidersLightweight(query: any) {
  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const providerIds = (data as any[]).map((p) => p.id);
  const userIds = [...new Set((data as any[]).map((p) => p.user_id))];

  // 4 parallel fetches
  const [profilesRes, servicesRes, boostsRes, impressionsRes, rankConfig] = await Promise.all([
    supabase
      .from('public_profiles' as any)
      .select('id, full_name, avatar_url')
      .in('id', userIds) as unknown as Promise<{ data: { id: string; full_name: string; avatar_url: string | null }[] | null }>,
    supabase
      .from('services')
      .select('id, provider_id, service_name, description, whatsapp, service_area, service_images(image_url, display_order)')
      .in('provider_id', providerIds),
    supabase
      .from('provider_boosts' as any)
      .select('provider_id, boost_weight')
      .in('provider_id', providerIds)
      .eq('is_active', true)
      .lte('start_at', new Date().toISOString())
      .gte('end_at', new Date().toISOString()) as any,
    supabase
      .from('provider_impressions' as any)
      .select('provider_id, impressions')
      .in('provider_id', providerIds)
      .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)) as any,
    getRankingConfig(),
  ]);

  const profileMap: Record<string, { name: string; avatar?: string }> = {};
  (profilesRes.data || []).forEach((p: any) => {
    profileMap[p.id] = { name: p.full_name, avatar: p.avatar_url || undefined };
  });

  // Boost aggregation
  const boostMap: Record<string, number> = {};
  (boostsRes.data || []).forEach((b: any) => {
    boostMap[b.provider_id] = (boostMap[b.provider_id] || 0) + (b.boost_weight || 0);
  });

  // Impressions aggregation (last 7 days)
  const impressionMap: Record<string, number> = {};
  (impressionsRes.data || []).forEach((i: any) => {
    impressionMap[i.provider_id] = (impressionMap[i.provider_id] || 0) + (i.impressions || 0);
  });

  const serviceRows = servicesRes.data || [];
  const serviceFallbackMap: Record<string, ServiceFallback> = {};
  const serviceImageMap: Record<string, string> = {};
  serviceRows.forEach((s: any) => {
    if (!serviceFallbackMap[s.provider_id]) {
      serviceFallbackMap[s.provider_id] = {
        serviceName: s.service_name || undefined,
        serviceDescription: s.description || undefined,
        serviceWhatsapp: s.whatsapp || undefined,
        serviceArea: s.service_area || undefined,
      };
    }
    if (!serviceImageMap[s.provider_id]) {
      const images = Array.isArray(s.service_images) ? s.service_images : [];
      const firstImage = images
        .slice()
        .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))[0]?.image_url;
      if (firstImage) {
        serviceImageMap[s.provider_id] = firstImage;
      }
    }
  });

  // Check if incomplete profiles should be hidden
  let hideIncomplete = false;
  try {
    const { data: hideSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'incomplete_profile_hide_public')
      .maybeSingle();
    hideIncomplete = (hideSetting as any)?.value === 'true';
  } catch { /* ignore */ }

  return (data as any[]).map((p) => {
    const profile = profileMap[p.user_id];
    const rawPhoto = p.photo_url || profile?.avatar || '';
    const photoCount = p.portfolio_photo_count || 0;
    const albumCount = p.portfolio_album_count || 0;
    const svcCount = p.services_count || 0;
    const hasPortfolio = photoCount > 0;

    const mapped = mapProvider(
      { ...p, photo_url: avatarThumb(rawPhoto) },
      profile?.name,
      serviceImageThumb(serviceImageMap[p.id]),
      hasPortfolio,
      serviceFallbackMap[p.id]
    );

    // Mark incomplete profiles for filtering
    const profileName = profile?.name?.trim() || '';
    const provCity = p.city?.trim() || '';
    const isIncomplete = !profileName || profileName === 'Profissional' || !provCity;
    (mapped as any)._isIncomplete = isIncomplete;

    // Hybrid score
    // Capped content score (anti-abuse)
    const photoScore = Math.min(photoCount, 20) * 2;
    const albumScore = Math.min(albumCount, 5) * 5;
    const contentScore =
      (rawPhoto ? 10 : 0) +
      (svcCount >= 1 ? 2 : 0) +
      (svcCount >= 3 ? 3 : 0) +
      photoScore +
      albumScore +
      (svcCount > 0 && photoCount > 0 ? 5 : 0);
    const boostScore = boostMap[p.id] || 0;
    const impressions7d = impressionMap[p.id] || 0;
    const fairnessPenalty = Math.log(1 + impressions7d) * rankConfig.fairnessPen;
    const randomFactor = Math.random() * rankConfig.randomMax;

    const finalScore = contentScore + (boostScore * rankConfig.boostMul) - fairnessPenalty + randomFactor;

    (mapped as any)._contentScore = contentScore;
    (mapped as any)._finalScore = finalScore;
    (mapped as any)._boostScore = boostScore;
    return mapped;
  }).filter(p => !hideIncomplete || !(p as any)._isIncomplete);
}

// fetchProvidersWithProfiles now uses the same fast path
const fetchProvidersWithProfiles = fetchProvidersLightweight;

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, icon')
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useCategoriesWithCount() {
  return useQuery({
    queryKey: ['categories-with-count'],
    queryFn: async () => {
      const [catsRes, provsRes] = await Promise.all([
        supabase.from('categories').select('id, name, slug, icon').order('name'),
        supabase.from('providers').select('category_id').eq('status', 'approved'),
      ]);

      if (catsRes.error) throw catsRes.error;

      const countMap: Record<string, number> = {};
      (provsRes.data || []).forEach((p) => {
        if (p.category_id) countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
      });

      return (catsRes.data || []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        count: countMap[c.id] || 0,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useFeaturedProviders() {
  return useQuery({
    queryKey: ['featured-providers'],
    queryFn: async () => {
      const allProviders = await fetchProvidersLightweight(
        supabase
          .from('providers')
          .select(providerSelect)
          .eq('status', 'approved')
          .limit(500)
      );

      if (allProviders.length === 0) return [];

      // Sort by hybrid score desc — featured = top of ranking, no fixed threshold
      const scored = allProviders
        .map((p) => ({
          ...p,
          _totalScore: (p as any)._finalScore || (p as any)._contentScore || 0,
        }))
        .sort((a, b) => b._totalScore - a._totalScore);

      // Pick target count: 9 > 6 > 3
      let target = 3;
      if (scored.length >= 9) target = 9;
      else if (scored.length >= 6) target = 6;

      // Take top candidates, light shuffle for variety
      const candidates = scored.slice(0, Math.min(scored.length, target * 2));
      const shuffled = shuffleArray(candidates);
      return shuffled.slice(0, target).map(({ _totalScore, _contentScore, _finalScore, _boostScore, ...p }: any) => p);
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

// --- GEO Intelligence v5: delegated to GeoEngine ---

function resolveProviderCoords(provider: DbProvider) {
  return GeoEngine.resolveProviderCoords(provider);
}

// Keep backward compat export
function normalizeCityName(name: string): string {
  return normalize(name);
}

// Backward-compatible wrapper for external callers using old signature
function matchesGeoContextCompat(
  provider: DbProvider,
  cityNorm: string,
  stateNorm?: string,
  userLat?: number | null,
  userLon?: number | null,
  radiusKm?: number,
): boolean {
  const intent = GeoEngine.resolve('', cityNorm, stateNorm);
  const ctx = GeoEngine.buildGeoContext(intent, userLat, userLon);
  if (radiusKm) (ctx as any).radius = radiusKm;
  const pCityNorm = normalize(provider.city);
  const pStateNorm = normalize(provider.state);
  const provCoords = resolveProviderCoords(provider);
  return GeoEngine.matchesGeoContext(pCityNorm, pStateNorm, provCoords, ctx);
}

export { normalizeCityName, matchesGeoContextCompat as matchesGeoContext };

const MIN_LOCAL_RESULTS = 3;

export function filterAndRankProviders(
  providers: DbProvider[],
  query: string,
  city: string,
  categorySlug: string,
  minRating: number,
  state?: string,
  userLat?: number | null,
  userLon?: number | null,
  radiusKm?: number
) {
  let results = [...providers];

  if (minRating > 0) {
    results = results.filter((p) => p.rating >= minRating);
  }

  if (categorySlug) {
    results = results.filter((p) => p.categorySlug === categorySlug);
  }

  // --- SIL v1: Analyze query via Search Intelligence Layer ---
  const sil = SearchIntelligence.analyze(query, city, state, userLat, userLon);
  const { intent, geoIntent, geoContext, serviceQuery } = sil;

  // Override radius if explicitly provided
  if (radiusKm) (geoContext as any).radius = radiusKm;

  // Apply textual filter using service tokens (cleaned by SIL)
  if (serviceQuery) {
    const terms = serviceQuery.toLowerCase().split(/\s+/).filter(Boolean);
    results = results.filter((p) =>
      terms.every((term) =>
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        (p.businessName?.toLowerCase().includes(term) ?? false) ||
        p.city.toLowerCase().includes(term) ||
        p.neighborhood.toLowerCase().includes(term) ||
        p.state.toLowerCase().includes(term)
      )
    );
  }

  // Route based on SIL intent
  if (intent !== 'SERVICE_ONLY' && (geoContext.cityNorm || geoContext.stateNorm)) {
    const enriched = results.map((p) => {
      const isLocal = SearchIntelligence.matchesGeo(p, geoContext);
      const gs = isLocal ? SearchIntelligence.providerGeoScore(p, geoContext, geoIntent.confidence) : 0;
      const relevance = SearchIntelligence.computeRelevanceScore(p, serviceQuery);
      const scored = SearchIntelligence.computeFinalScore(gs, relevance, intent);
      return { p, isLocal, gs, scored };
    });

    const localResults = enriched.filter((e) => e.isLocal);
    const otherResults = enriched.filter((e) => !e.isLocal);

    let final: typeof enriched;
    if (localResults.length >= MIN_LOCAL_RESULTS) {
      final = localResults;
    } else {
      final = [...localResults, ...otherResults];
    }

    // Sort by: local first, then SIL final score, then existing content score
    final.sort((a, b) => {
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      if (a.scored.finalScore !== b.scored.finalScore) return b.scored.finalScore - a.scored.finalScore;
      const aScore = (a.p as any)._finalScore || (a.p as any)._contentScore || 0;
      const bScore = (b.p as any)._finalScore || (b.p as any)._contentScore || 0;
      if (aScore !== bScore) return bScore - aScore;
      if (b.p.rating !== a.p.rating) return b.p.rating - a.p.rating;
      return b.p.reviewCount - a.p.reviewCount;
    });

    SearchIntelligence.trackFinalScore(query, intent, final.length);
    return final.map((e) => e.p);
  }

  // SERVICE_ONLY — sort by existing content score
  results.sort((a, b) => {
    const aScore = (a as any)._finalScore || (a as any)._contentScore || 0;
    const bScore = (b as any)._finalScore || (b as any)._contentScore || 0;
    if (aScore !== bScore) return bScore - aScore;
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.reviewCount - a.reviewCount;
  });

  SearchIntelligence.trackFinalScore(query, intent, results.length);
  return results;
}

export function useSearchProviders(query: string, city: string, categorySlug: string, minRating: number, state?: string, userLat?: number | null, userLon?: number | null, radiusKm?: number) {
  const baseQuery = useQuery({
    queryKey: ['search-providers-base'],
    queryFn: async () => {
      return fetchProvidersWithProfiles(
        supabase
        .from('providers')
        .select(providerSelect)
        .eq('status', 'approved')
        .order('rating_avg', { ascending: false })
        .order('review_count', { ascending: false })
      );
    },
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });

  const filteredData = useMemo(
    () => filterAndRankProviders(baseQuery.data || [], query, city, categorySlug, minRating, state, userLat, userLon, radiusKm),
    [baseQuery.data, query, city, categorySlug, minRating, state, userLat, userLon, radiusKm]
  );

  return {
    ...baseQuery,
    data: filteredData,
  };
}

export function useSearchSuggestions() {
  return useQuery({
    queryKey: ['search-suggestions'],
    queryFn: async () => {
      const [catRes, cityRes, serviceRes] = await Promise.all([
        supabase.from('categories').select('name, slug, icon').order('name'),
        supabase.from('cities').select('name, slug, state').order('name').limit(50),
        supabase.from('popular_services').select('name, slug, category_name').eq('active', true).order('display_order').limit(30),
      ]);
      return {
        categories: catRes.data || [],
        cities: cityRes.data || [],
        services: serviceRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Returns only categories that have approved providers, sorted by GPS proximity.
 */
export function useGeoCategories(userLat?: number | null, userLon?: number | null) {
  return useQuery({
    queryKey: ['geo-categories', userLat ?? 'none', userLon ?? 'none'],
    queryFn: async () => {
      // Fetch categories + providers with coords in parallel
      const [catsRes, provsRes] = await Promise.all([
        supabase.from('categories').select('id, name, slug, icon'),
        supabase.from('providers').select('category_id, latitude, longitude').eq('status', 'approved'),
      ]);
      if (catsRes.error) throw catsRes.error;

      const cats = catsRes.data || [];
      const provs = provsRes.data || [];

      // Build map: category_id -> { count, coords[] }
      const catMap: Record<string, { count: number; coords: { latitude: number; longitude: number }[] }> = {};
      provs.forEach((p: any) => {
        if (!p.category_id) return;
        if (!catMap[p.category_id]) catMap[p.category_id] = { count: 0, coords: [] };
        catMap[p.category_id].count++;
        if (Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) {
          catMap[p.category_id].coords.push({ latitude: p.latitude, longitude: p.longitude });
        }
      });

      // Only categories with providers
      let result = cats
        .filter((c) => catMap[c.id]?.count > 0)
        .map((c) => {
          const info = catMap[c.id];
          let minDistance = Infinity;

          if (userLat != null && userLon != null && Number.isFinite(userLat) && Number.isFinite(userLon)) {
            info.coords.forEach((coord) => {
              const dist = calculateDistanceKmSimple(userLat, userLon, coord.latitude, coord.longitude);
              if (dist < minDistance) minDistance = dist;
            });
          }

          return { ...c, providerCount: info.count, minDistance };
        });

      // Sort: by proximity if GPS available, otherwise by provider count
      if (userLat != null && userLon != null && Number.isFinite(userLat) && Number.isFinite(userLon)) {
        result.sort((a, b) => a.minDistance - b.minDistance);
      } else {
        // Shuffle for variety when no GPS
        for (let i = result.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [result[i], result[j]] = [result[j], result[i]];
        }
      }

      return result;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/** Lightweight Haversine for sorting only */
function calculateDistanceKmSimple(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useCategoryProviders(categorySlug: string) {
  return useQuery({
    queryKey: ['category-providers', categorySlug],
    queryFn: async () => {
      const { data: cat } = await supabase
        .from('categories')
        .select('id, name, slug, icon')
        .eq('slug', categorySlug)
        .maybeSingle();

      if (!cat) return { category: null, providers: [] };

      const providers = await fetchProvidersWithProfiles(
        supabase
          .from('providers')
          .select(providerSelect)
          .eq('status', 'approved')
          .eq('category_id', cat.id)
          .order('rating_avg', { ascending: false })
      );

      return { category: cat, providers };
    },
    enabled: !!categorySlug,
  });
}
