import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { avatarThumb, serviceImageThumb } from '@/lib/imageOptimizer';

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

const providerSelect = 'id, user_id, business_name, description, photo_url, city, state, neighborhood, phone, whatsapp, years_experience, plan, slug, featured, rating_avg, review_count, status, category_id, categories(name, slug, icon)';

// Cache portfolio folder list (single storage call, reused across hooks)
let _portfolioCachePromise: Promise<Set<string>> | null = null;
let _portfolioCacheTime = 0;
const PORTFOLIO_CACHE_TTL = 10 * 60_000; // 10 min

async function getPortfolioSet(): Promise<Set<string>> {
  const now = Date.now();
  if (_portfolioCachePromise && now - _portfolioCacheTime < PORTFOLIO_CACHE_TTL) {
    return _portfolioCachePromise;
  }
  _portfolioCacheTime = now;
  _portfolioCachePromise = (async () => {
    try {
      const { data: folders } = await supabase.storage.from('portfolio').list('', { limit: 1000 });
      const set = new Set<string>();
      (folders || []).forEach((f: any) => {
        if (f.name && f.name !== '.emptyFolderPlaceholder' && f.id === null) {
          // folders have id=null in storage listing
          set.add(f.name);
        }
      });
      return set;
    } catch {
      return new Set<string>();
    }
  })();
  return _portfolioCachePromise;
}

/**
 * Shared fetch logic for providers — single storage call for portfolios.
 */
async function fetchProvidersLightweight(query: any) {
  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const providerIds = (data as any[]).map((p) => p.id);
  const userIds = [...new Set((data as any[]).map((p) => p.user_id))];

  // 3 parallel fetches: profiles + services + portfolio folders (single call)
  const [profilesRes, servicesRes, portfolioSet] = await Promise.all([
    supabase
      .from('public_profiles' as any)
      .select('id, full_name, avatar_url')
      .in('id', userIds) as unknown as Promise<{ data: { id: string; full_name: string; avatar_url: string | null }[] | null }>,
    supabase
      .from('services')
      .select('id, provider_id, service_name, description, whatsapp, service_area, service_images(image_url, display_order)')
      .in('provider_id', providerIds),
    getPortfolioSet(),
  ]);

  const profileMap: Record<string, { name: string; avatar?: string }> = {};
  (profilesRes.data || []).forEach((p: any) => {
    profileMap[p.id] = { name: p.full_name, avatar: p.avatar_url || undefined };
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
    return mapProvider(
      { ...p, photo_url: avatarThumb(rawPhoto) },
      profile?.name,
      serviceImageThumb(serviceImageMap[p.id]),
      portfolioSet.has(p.user_id),
      serviceFallbackMap[p.id]
    );
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
      const providers = await fetchProvidersLightweight(
        supabase
          .from('providers')
          .select(providerSelect)
          .eq('status', 'approved')
          .eq('featured', true)
          .limit(200)
      );

      // Regra: imagem de serviço OU portfólio (conteúdo visual)
      const valid = providers.filter((p) => !!p.serviceImage || !!p.hasPortfolio);
      if (valid.length === 0) return [];

      const shuffled = shuffleArray(valid);
      const count = pickFeaturedCount(shuffled.length);
      return shuffled.slice(0, count);
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

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

  if (city) {
    const lc = city.toLowerCase();
    results = results.filter(
      (p) =>
        p.city.toLowerCase().includes(lc) ||
        p.state.toLowerCase().includes(lc) ||
        p.neighborhood.toLowerCase().includes(lc)
    );
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

  const planPriority: Record<string, number> = { premium: 0, pro: 1, free: 2 };
  results.sort((a, b) => {
    const aImg = a.serviceImage || a.hasPortfolio ? 0 : 1;
    const bImg = b.serviceImage || b.hasPortfolio ? 0 : 1;
    if (aImg !== bImg) return aImg - bImg;
    const pa = planPriority[a.plan] ?? 2;
    const pb = planPriority[b.plan] ?? 2;
    if (pa !== pb) return pa - pb;
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
