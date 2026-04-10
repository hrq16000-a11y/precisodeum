import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { avatarThumb, serviceImageThumb } from '@/lib/imageOptimizer';
import { calculateDistanceKm, hasCoordinates } from '@/lib/geoDistance';
import { getCityCoords, isRecognizedCity } from '@/lib/cityCoords';
import { resolveMetroRegion, isMemberOfMetro } from '@/lib/metroRegions';
import { normalize } from '@/lib/normalize';
import { extractUFFromQuery, isUF, getUFCapital } from '@/lib/ufIndex';
import { lookupCity } from '@/lib/citiesIndex';

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
  });
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

// --- Geo Intelligence v3 ---

const CAPITALS = new Set([
  'saopaulo','riodejaneiro','brasilia','salvador','fortaleza','belohorizonte',
  'manaus','curitiba','recife','portoalegre','belem','goiania',
  'saoluis','maceio','natal','teresina','campogrande','joaopessoa',
  'aracaju','cuiaba','florianopolis','palmas','macapa','boavista','riobranco',
  'vitoria','portovelho',
]);

function isCapital(cityNorm: string): boolean {
  return CAPITALS.has(cityNorm);
}

function resolveProviderCoords(provider: DbProvider): { lat: number; lon: number } | null {
  if (hasCoordinates(provider.latitude, provider.longitude)) {
    return { lat: provider.latitude!, lon: provider.longitude! };
  }
  return getCityCoords(provider.city);
}

function dynamicRadius(cityNorm: string, metroDetected: boolean): number {
  if (metroDetected) return 100;
  if (isCapital(cityNorm)) return 120;
  return 60;
}

/**
 * Extract the core city name from geo-detected strings like
 * "Região Metropolitana de Curitiba" → "curitiba"
 * "Grande São Paulo" → "saopaulo"
 */
function extractCoreCity(cityNorm: string): string {
  if (cityNorm.startsWith('regiaometropolitanade')) {
    return cityNorm.slice('regiaometropolitanade'.length);
  }
  if (cityNorm.startsWith('regiaometropolitana')) {
    return cityNorm.slice('regiaometropolitana'.length);
  }
  if (cityNorm.startsWith('grande')) {
    return cityNorm.slice(6);
  }
  return cityNorm;
}

interface GeoContext {
  cityNorm: string;
  stateNorm: string;
  coreCity: string;
  userCoords: { latitude: number; longitude: number } | null;
  metro: ReturnType<typeof resolveMetroRegion>;
  radius: number;
}

function buildGeoContext(
  city: string, state?: string,
  userLat?: number | null, userLon?: number | null,
): GeoContext {
  const cityNorm = normalize(city);
  const stateNorm = normalize(state);
  const coreCity = extractCoreCity(cityNorm);
  const metro = cityNorm ? resolveMetroRegion(cityNorm, stateNorm || undefined) : null;
  const userCoords = hasCoordinates(userLat, userLon)
    ? { latitude: userLat!, longitude: userLon! }
    : null;
  const radius = dynamicRadius(coreCity || cityNorm, !!metro);
  return { cityNorm, stateNorm, coreCity, userCoords, metro, radius };
}

function matchesGeoContext(
  pCityNorm: string,
  pStateNorm: string,
  provCoords: { lat: number; lon: number } | null,
  ctx: GeoContext,
): boolean {
  if (!ctx.cityNorm && !ctx.stateNorm) return true;

  // Layer 1: Haversine with dynamic radius
  if (ctx.userCoords && provCoords) {
    const dist = calculateDistanceKm(
      ctx.userCoords,
      { latitude: provCoords.lat, longitude: provCoords.lon },
    );
    if (dist <= ctx.radius) return true;
  }

  // Layer 2: Metro region membership (blocks non-members)
  if (ctx.metro) {
    return isMemberOfMetro(pCityNorm, ctx.metro) || pCityNorm === ctx.coreCity;
  }

  // Layer 3: Fuzzy city name match
  if (ctx.cityNorm) {
    if (pCityNorm === ctx.cityNorm) return true;
    if (pCityNorm.includes(ctx.cityNorm) || ctx.cityNorm.includes(pCityNorm)) return true;
    if (ctx.coreCity !== ctx.cityNorm) {
      if (pCityNorm === ctx.coreCity) return true;
      if (pCityNorm.includes(ctx.coreCity) || ctx.coreCity.includes(pCityNorm)) return true;
    }
  }

  // Layer 4: Same state fallback (only if no metro detected)
  if (ctx.stateNorm && pStateNorm === ctx.stateNorm) return true;

  return false;
}

function geoScore(
  pCityNorm: string,
  pStateNorm: string,
  provCoords: { lat: number; lon: number } | null,
  ctx: GeoContext,
): number {
  let score = 0;

  if (pCityNorm === (ctx.coreCity || ctx.cityNorm)) score += 100;

  if (ctx.metro && isMemberOfMetro(pCityNorm, ctx.metro)) score += 70;

  if (ctx.userCoords && provCoords) {
    const d = calculateDistanceKm(
      ctx.userCoords,
      { latitude: provCoords.lat, longitude: provCoords.lon },
    );
    if (d <= 30) score += 50;
    else if (d <= 80) score += 30;
  }

  if (pStateNorm === ctx.stateNorm) score += 10;

  return score;
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
  const ctx = buildGeoContext(cityNorm, stateNorm, userLat, userLon);
  if (radiusKm) (ctx as any).radius = radiusKm;
  const pCityNorm = normalize(provider.city);
  const pStateNorm = normalize(provider.state);
  const provCoords = resolveProviderCoords(provider);
  return matchesGeoContext(pCityNorm, pStateNorm, provCoords, ctx);
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

  // --- Geo Intelligence: detect geographic intent inside query ---
  let effectiveCity = city;
  let effectiveState = state;
  let effectiveLat = userLat;
  let effectiveLon = userLon;
  let textualQuery = query;

  if (query) {
    const queryNorm = normalize(query);

    // 1. Full query is a metro region? e.g. "Região Metropolitana de Curitiba"
    const metroFromQuery = resolveMetroRegion(queryNorm);
    if (metroFromQuery) {
      const poleCoords = getCityCoords(metroFromQuery.pole);
      effectiveCity = metroFromQuery.pole;
      effectiveState = metroFromQuery.state;
      if (poleCoords) {
        effectiveLat = poleCoords.lat;
        effectiveLon = poleCoords.lon;
      }
      textualQuery = ''; // pure geo query, no text filter
    }
    // 2. Full query is a known city? e.g. "Curitiba"
    else if (getCityCoords(queryNorm)) {
      const coords = getCityCoords(queryNorm)!;
      effectiveCity = queryNorm;
      effectiveLat = coords.lat;
      effectiveLon = coords.lon;
      textualQuery = '';
    }
    // 3. Mixed query: "encanador Curitiba" — try to extract city token
    else {
      const rawTokens = query.trim().split(/\s+/);
      // Try progressively longer suffixes (right-to-left) for multi-word cities
      let bestCityMatch = '';
      let bestCityIdx = -1;
      for (let i = rawTokens.length - 1; i >= 0; i--) {
        const candidate = rawTokens.slice(i).join(' ');
        const candidateNorm = normalize(candidate);
        if (getCityCoords(candidateNorm)) {
          bestCityMatch = candidateNorm;
          bestCityIdx = i;
        }
      }
      if (bestCityMatch && bestCityIdx > 0) {
        const coords = getCityCoords(bestCityMatch)!;
        effectiveCity = bestCityMatch;
        effectiveLat = coords.lat;
        effectiveLon = coords.lon;
        textualQuery = rawTokens.slice(0, bestCityIdx).join(' ');
      }
    }
  }

  // Apply textual filter only with non-geo terms
  if (textualQuery) {
    const lq = textualQuery.toLowerCase();
    const terms = lq.split(/\s+/).filter(Boolean);
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

  const ctx = buildGeoContext(effectiveCity, effectiveState, effectiveLat, effectiveLon);
  // Override radius if explicitly provided
  if (radiusKm) (ctx as any).radius = radiusKm;

  if (ctx.cityNorm || ctx.stateNorm) {
    // Pre-compute normalized values + coords once per provider
    const enriched = results.map((p) => {
      const pCityNorm = normalize(p.city);
      const pStateNorm = normalize(p.state);
      const provCoords = resolveProviderCoords(p);
      const isLocal = matchesGeoContext(pCityNorm, pStateNorm, provCoords, ctx);
      const gs = isLocal ? geoScore(pCityNorm, pStateNorm, provCoords, ctx) : 0;
      return { p, pCityNorm, isLocal, gs };
    });

    const localResults = enriched.filter((e) => e.isLocal);
    const otherResults = enriched.filter((e) => !e.isLocal);

    let final: typeof enriched;
    if (localResults.length >= MIN_LOCAL_RESULTS) {
      final = localResults;
    } else {
      final = [...localResults, ...otherResults];
    }

    // Sort by: local first, then geoScore, then existing _finalScore
    final.sort((a, b) => {
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      if (a.gs !== b.gs) return b.gs - a.gs;
      const aScore = (a.p as any)._finalScore || (a.p as any)._contentScore || 0;
      const bScore = (b.p as any)._finalScore || (b.p as any)._contentScore || 0;
      if (aScore !== bScore) return bScore - aScore;
      if (b.p.rating !== a.p.rating) return b.p.rating - a.p.rating;
      return b.p.reviewCount - a.p.reviewCount;
    });

    return final.map((e) => e.p);
  }

  // No geo filter — sort by existing score
  results.sort((a, b) => {
    const aScore = (a as any)._finalScore || (a as any)._contentScore || 0;
    const bScore = (b as any)._finalScore || (b as any)._contentScore || 0;
    if (aScore !== bScore) return bScore - aScore;
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.reviewCount - a.reviewCount;
  });

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
