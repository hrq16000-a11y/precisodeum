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

function mapProvider(p: any): DbProvider {
  return {
    id: p.id,
    name: (p.profiles as any)?.full_name || p.business_name || 'Profissional',
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

const providerSelect = '*, categories(name, slug, icon), profiles:user_id(full_name, avatar_url)';

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('providers')
        .select(providerSelect)
        .eq('status', 'approved')
        .eq('featured', true)
        .order('rating_avg', { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data || []).map(mapProvider);
    },
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

      const { data, error } = await q.order('rating_avg', { ascending: false });
      if (error) throw error;

      let results = (data || []).map(mapProvider);

      // Filter by category slug client-side since it's a join field
      if (categorySlug) {
        results = results.filter((p) => p.categorySlug === categorySlug);
      }

      // Also filter by query matching name/category
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
      // Get category id first
      const { data: cat } = await supabase
        .from('categories')
        .select('id, name, slug, icon')
        .eq('slug', categorySlug)
        .maybeSingle();

      if (!cat) return { category: null, providers: [] };

      const { data, error } = await supabase
        .from('providers')
        .select(providerSelect)
        .eq('status', 'approved')
        .eq('category_id', cat.id)
        .order('rating_avg', { ascending: false });

      if (error) throw error;

      return {
        category: cat,
        providers: (data || []).map(mapProvider),
      };
    },
    enabled: !!categorySlug,
  });
}
