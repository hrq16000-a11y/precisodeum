import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { avatarThumb, serviceImageThumb, originalUrl } from '@/lib/imageOptimizer';

export interface DbProvider {
  id: string;
  name: string;
  businessName?: string;
  category: string;
  categorySlug: string;
  categoryIcon: string;
  city: string;
  state: string;
  neighborhood: string;
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

  // Fallback: whatsapp ↔ phone
  const effectiveWhatsapp = provWhatsapp || provPhone || serviceFallback?.serviceWhatsapp || '';
  const effectivePhone = provPhone || provWhatsapp || serviceFallback?.serviceWhatsapp || '';

  return {
    id: p.id,
    name: profileName || p.business_name || serviceFallback?.serviceName || 'Profissional',
    businessName: p.business_name || undefined,
    category: catName || serviceFallback?.serviceName || '',
    categorySlug: (p.categories as any)?.slug || '',
    categoryIcon: (p.categories as any)?.icon || '🔧',
    city: provCity,
    state: provState,
    neighborhood: provNeighborhood,
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
  };
}

const providerSelect = 'id, user_id, business_name, description, photo_url, city, state, neighborhood, phone, whatsapp, years_experience, plan, slug, featured, rating_avg, review_count, status, category_id, portfolio_photo_count, portfolio_album_count, services_count, categories(name, slug, icon)';

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
    const contentScore =
      (rawPhoto ? 10 : 0) +
      (svcCount >= 1 ? 2 : 0) +
      (svcCount >= 3 ? 3 : 0) +
      (photoCount * 2) +
      (albumCount * 5);
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

const FEATURED_SCORE_THRESHOLD = 5;

export function useFeaturedProviders() {
  return useQuery({
    queryKey: ['featured-providers'],
    queryFn: async () => {
      // Fetch all approved providers — featured is now score-based
      const allProviders = await fetchProvidersLightweight(
        supabase
          .from('providers')
          .select(providerSelect)
          .eq('status', 'approved')
          .limit(500)
      );

      // Filter by content score threshold
      const scored = allProviders
        .map((p) => ({
          ...p,
          _totalScore: (p as any)._contentScore || 0,
        }))
        .filter(p => p._totalScore >= FEATURED_SCORE_THRESHOLD);

      if (scored.length === 0) return [];

      // Sort by total score desc
      scored.sort((a, b) => b._totalScore - a._totalScore);

      // Pick target count: 9 > 6 > 3
      let target = 3;
      if (scored.length >= 9) target = 9;
      else if (scored.length >= 6) target = 6;

      // Light shuffle within top candidates to keep variety
      const candidates = scored.slice(0, Math.min(scored.length, target * 2));
      const shuffled = shuffleArray(candidates);
      return shuffled.slice(0, target).map(({ _totalScore, _contentScore, ...p }: any) => p);
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

/**
 * Normalize a city/state string for fuzzy comparison.
 * Removes accents, lowercases, strips hyphens/spaces.
 */
function normalizeCityName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_\s]+/g, '')
    .trim();
}

/** Check if provider matches city/state context */
function matchesGeoContext(provider: DbProvider, cityNorm: string): boolean {
  if (!cityNorm) return true;
  const pCity = normalizeCityName(provider.city);
  const pState = normalizeCityName(provider.state);
  // Exact city match
  if (pCity === cityNorm) return true;
  // City contains search or search contains city (e.g. "sao paulo" vs "são paulo")
  if (pCity.includes(cityNorm) || cityNorm.includes(pCity)) return true;
  // State match (e.g. searching "SP" or "sao-paulo" matching state)
  if (pState === cityNorm || pState.includes(cityNorm)) return true;
  return false;
}

const MIN_LOCAL_RESULTS = 3;

export function filterAndRankProviders(
  providers: DbProvider[],
  query: string,
  city: string,
  categorySlug: string,
  minRating: number
) {
  let results = [...providers];

  if (minRating > 0) {
    results = results.filter((p) => p.rating >= minRating);
  }

  if (categorySlug) {
    results = results.filter((p) => p.categorySlug === categorySlug);
  }

  if (query) {
    const lq = query.toLowerCase();
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

  const cityNorm = city ? normalizeCityName(city) : '';

  // Smart city filtering: filter by city when context exists,
  // but fall back to global + ranking if too few local results
  if (cityNorm) {
    const localResults = results.filter((p) => matchesGeoContext(p, cityNorm));
    const otherResults = results.filter((p) => !matchesGeoContext(p, cityNorm));

    if (localResults.length >= MIN_LOCAL_RESULTS) {
      // Enough local results — show only local
      results = localResults;
    } else {
      // Few local results — show local first, then others
      results = [...localResults, ...otherResults];
    }
  }

  const planPriority: Record<string, number> = { premium: 0, pro: 1, free: 2 };

  results.sort((a, b) => {
    // 1. City match first (for fallback/expanded results)
    if (cityNorm) {
      const aLocal = matchesGeoContext(a, cityNorm) ? 0 : 1;
      const bLocal = matchesGeoContext(b, cityNorm) ? 0 : 1;
      if (aLocal !== bLocal) return aLocal - bLocal;
    }
    // 2. Hybrid final score (content + boost - fairness + random)
    const aScore = (a as any)._finalScore || (a as any)._contentScore || 0;
    const bScore = (b as any)._finalScore || (b as any)._contentScore || 0;
    if (aScore !== bScore) return bScore - aScore;
    // 3. Rating & reviews tiebreaker
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.reviewCount - a.reviewCount;
  });

  return results;
}

export function useSearchProviders(query: string, city: string, categorySlug: string, minRating: number) {
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
    () => filterAndRankProviders(baseQuery.data || [], query, city, categorySlug, minRating),
    [baseQuery.data, query, city, categorySlug, minRating]
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
