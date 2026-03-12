import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbProvider {
  id: string;
  name: string;
  businessName?: string;
  category: string;
  categorySlug: string;
  city: string;
  state: string;
  neighborhood: string;
  rating: number;
  reviewCount: number;
  photo: string;
  description: string;
  phone: string;
  whatsapp: string;
  yearsExperience: number;
  plan: string;
  slug: string;
  featured: boolean;
}

function mapProvider(p: any, profileName?: string): DbProvider {
  return {
    id: p.id,
    name: profileName || p.business_name || 'Profissional',
    businessName: p.business_name || undefined,
    category: (p.categories as any)?.name || '',
    categorySlug: (p.categories as any)?.slug || '',
    city: p.city,
    state: p.state,
    neighborhood: p.neighborhood,
    rating: Number(p.rating_avg) || 0,
    reviewCount: p.review_count || 0,
    photo: p.photo_url || '',
    description: p.description,
    phone: p.phone,
    whatsapp: p.whatsapp,
    yearsExperience: p.years_experience,
    plan: p.plan,
    slug: p.slug || p.id,
    featured: p.featured,
  };
}

const providerSelect = '*, categories(name, slug, icon)';

async function fetchProvidersWithProfiles(query: any) {
  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Fetch profiles for all user_ids
  const userIds = [...new Set((data as any[]).map((p) => p.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);

  const profileMap: Record<string, string> = {};
  (profiles || []).forEach((p) => {
    profileMap[p.id] = p.full_name;
  });

  return (data as any[]).map((p) => mapProvider(p, profileMap[p.user_id]));
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCategoriesWithCount() {
  return useQuery({
    queryKey: ['categories-with-count'],
    queryFn: async () => {
      const { data: cats, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;

      const { data: providers } = await supabase
        .from('providers')
        .select('category_id')
        .eq('status', 'approved');

      const countMap: Record<string, number> = {};
      (providers || []).forEach((p) => {
        if (p.category_id) countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
      });

      return (cats || []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        count: countMap[c.id] || 0,
      }));
    },
  });
}

export function useFeaturedProviders() {
  return useQuery({
    queryKey: ['featured-providers'],
    queryFn: () =>
      fetchProvidersWithProfiles(
        supabase
          .from('providers')
          .select(providerSelect)
          .eq('status', 'approved')
          .eq('featured', true)
          .order('rating_avg', { ascending: false })
          .limit(6)
      ),
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

      if (query) {
        q = q.or(`description.ilike.%${query}%,business_name.ilike.%${query}%`);
      }
      if (city) {
        q = q.ilike('city', `%${city}%`);
      }
      if (minRating > 0) {
        q = q.gte('rating_avg', minRating);
      }

      let results = await fetchProvidersWithProfiles(q.order('rating_avg', { ascending: false }));

      if (categorySlug) {
        results = results.filter((p) => p.categorySlug === categorySlug);
      }

      if (query) {
        const lq = query.toLowerCase();
        results = results.filter(
          (p) =>
            p.name.toLowerCase().includes(lq) ||
            p.category.toLowerCase().includes(lq) ||
            p.description.toLowerCase().includes(lq) ||
            (p.businessName?.toLowerCase().includes(lq) ?? false)
        );
      }

      return results;
    },
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
