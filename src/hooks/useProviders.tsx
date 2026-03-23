import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

function mapProvider(p: any, profileName?: string, serviceImage?: string, hasPortfolio?: boolean): DbProvider {
  return {
    id: p.id,
    name: profileName || p.business_name || 'Profissional',
    businessName: p.business_name || undefined,
    category: (p.categories as any)?.name || '',
    categorySlug: (p.categories as any)?.slug || '',
    categoryIcon: (p.categories as any)?.icon || '🔧',
    city: p.city,
    state: p.state,
    neighborhood: p.neighborhood,
    rating: Number(p.rating_avg) || 0,
    reviewCount: p.review_count || 0,
    photo: p.photo_url || '',
    serviceImage: serviceImage || undefined,
    hasPortfolio: hasPortfolio || false,
    description: p.description,
    phone: p.phone,
    whatsapp: p.whatsapp,
    yearsExperience: p.years_experience,
    plan: p.plan,
    slug: p.slug || p.id,
    featured: p.featured,
  };
}

const providerSelect = 'id, user_id, business_name, description, photo_url, city, state, neighborhood, phone, whatsapp, years_experience, plan, slug, featured, rating_avg, review_count, status, category_id, categories(name, slug, icon)';

/**
 * Lightweight fetch: skips portfolio storage checks entirely.
 * Used for home page listings where speed is critical.
 */
async function fetchProvidersLightweight(query: any) {
  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const providerIds = (data as any[]).map((p) => p.id);
  const userIds = [...new Set((data as any[]).map((p) => p.user_id))];

  // Parallel fetches: profiles + service images only (NO portfolio storage calls)
  const [profilesRes, servicesRes] = await Promise.all([
    supabase
      .from('public_profiles' as any)
      .select('id, full_name, avatar_url')
      .in('id', userIds) as unknown as Promise<{ data: { id: string; full_name: string; avatar_url: string | null }[] | null }>,
    supabase
      .from('services')
      .select('id, provider_id')
      .in('provider_id', providerIds),
  ]);

  const profileMap: Record<string, { name: string; avatar?: string }> = {};
  (profilesRes.data || []).forEach((p: any) => {
    profileMap[p.id] = { name: p.full_name, avatar: p.avatar_url || undefined };
  });

  const serviceRows = servicesRes.data || [];
  const serviceIds = serviceRows.map((s: any) => s.id);
  const serviceToProvider: Record<string, string> = {};
  serviceRows.forEach((s: any) => { serviceToProvider[s.id] = s.provider_id; });

  const serviceImageMap: Record<string, string> = {};
  if (serviceIds.length > 0) {
    const { data: serviceImages } = await supabase
      .from('service_images')
      .select('service_id, image_url')
      .in('service_id', serviceIds)
      .order('display_order')
      .limit(200);

    (serviceImages || []).forEach((si: any) => {
      const pid = serviceToProvider[si.service_id];
      if (pid && !serviceImageMap[pid]) {
        serviceImageMap[pid] = si.image_url;
      }
    });
  }

  // Mark hasPortfolio = true if provider has service images (fast heuristic, no storage calls)
  return (data as any[]).map((p) => {
    const profile = profileMap[p.user_id];
    const photo = p.photo_url || profile?.avatar || '';
    const hasServiceImage = !!serviceImageMap[p.id];
    const mapped = mapProvider(
      { ...p, photo_url: photo },
      profile?.name,
      serviceImageMap[p.id],
      hasServiceImage // use service images as portfolio indicator
    );
    return mapped;
  });
}

/**
 * Full fetch with portfolio storage checks.
 * Used only for detail pages (search, category, profile).
 */
async function fetchProvidersWithProfiles(query: any) {
  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const providerIds = (data as any[]).map((p) => p.id);
  const userIds = [...new Set((data as any[]).map((p) => p.user_id))];

  const [profilesRes, servicesRes] = await Promise.all([
    supabase
      .from('public_profiles' as any)
      .select('id, full_name, avatar_url')
      .in('id', userIds) as unknown as Promise<{ data: { id: string; full_name: string; avatar_url: string | null }[] | null }>,
    supabase
      .from('services')
      .select('id, provider_id')
      .in('provider_id', providerIds),
  ]);

  const profileMap: Record<string, { name: string; avatar?: string }> = {};
  (profilesRes.data || []).forEach((p: any) => {
    profileMap[p.id] = { name: p.full_name, avatar: p.avatar_url || undefined };
  });

  const serviceRows = servicesRes.data || [];
  const serviceIds = serviceRows.map((s: any) => s.id);
  const serviceToProvider: Record<string, string> = {};
  serviceRows.forEach((s: any) => { serviceToProvider[s.id] = s.provider_id; });

  const serviceImageMap: Record<string, string> = {};
  if (serviceIds.length > 0) {
    const { data: serviceImages } = await supabase
      .from('service_images')
      .select('service_id, image_url')
      .in('service_id', serviceIds)
      .order('display_order')
      .limit(200);

    (serviceImages || []).forEach((si: any) => {
      const pid = serviceToProvider[si.service_id];
      if (pid && !serviceImageMap[pid]) {
        serviceImageMap[pid] = si.image_url;
      }
    });
  }

  // Portfolio checks - batch with concurrency limit of 5
  const portfolioMap: Record<string, boolean> = {};
  const BATCH_SIZE = 5;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (uid) => {
      try {
        const { data: files } = await supabase.storage.from('portfolio').list(uid, { limit: 1 });
        if (files && files.filter(f => f.name !== '.emptyFolderPlaceholder').length > 0) {
          portfolioMap[uid] = true;
        }
      } catch { /* ignore */ }
    }));
  }

  return (data as any[]).map((p) => {
    const profile = profileMap[p.user_id];
    const photo = p.photo_url || profile?.avatar || '';
    const mapped = mapProvider(
      { ...p, photo_url: photo },
      profile?.name,
      serviceImageMap[p.id],
      portfolioMap[p.user_id] || false
    );
    return mapped;
  });
}

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
    queryFn: () =>
      fetchProvidersLightweight(
        supabase
          .from('providers')
          .select(providerSelect)
          .eq('status', 'approved')
          .eq('featured', true)
          .limit(30)
      ),
    staleTime: 1000 * 60 * 3,
  });
}

export function useSearchProviders(query: string, city: string, categorySlug: string, minRating: number) {
  return useQuery({
    queryKey: ['search-providers', query, city, categorySlug, minRating],
    queryFn: async () => {
      let q = supabase
        .from('providers')
        .select(providerSelect)
        .eq('status', 'approved');

      if (minRating > 0) {
        q = q.gte('rating_avg', minRating);
      }

      let results = await fetchProvidersWithProfiles(
        q.order('rating_avg', { ascending: false }).order('review_count', { ascending: false })
      );

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
        const aImg = (a.serviceImage || a.hasPortfolio) ? 0 : 1;
        const bImg = (b.serviceImage || b.hasPortfolio) ? 0 : 1;
        if (aImg !== bImg) return aImg - bImg;
        const pa = planPriority[a.plan] ?? 2;
        const pb = planPriority[b.plan] ?? 2;
        if (pa !== pb) return pa - pb;
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.reviewCount - a.reviewCount;
      });

      return results;
    },
  });
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
