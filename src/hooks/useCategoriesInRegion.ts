import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon: string;
  parent_id: string | null;
  count: number;
}

/**
 * Categorias com prestadores ativos. Quando city/state são informados,
 * retorna somente categorias com pelo menos 1 prestador na cidade.
 * Caso não haja resultados na cidade, faz fallback para o estado e depois global.
 */
export function useCategoriesInRegion(city?: string | null, state?: string | null) {
  return useQuery({
    queryKey: ['categories-in-region', city || 'all', state || 'all'],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<{ items: CategoryItem[]; scope: 'city' | 'state' | 'global' }> => {
      const catsRes = await supabase
        .from('categories')
        .select('id, name, slug, icon, parent_id')
        .is('deleted_at', null)
        .order('name');
      if (catsRes.error) throw catsRes.error;
      const cats = catsRes.data || [];

      const buildMap = async (
        filter?: (q: any) => any
      ): Promise<Record<string, number>> => {
        let q: any = supabase
          .from('providers')
          .select('category_id, city, state')
          .eq('status', 'approved')
          .limit(2000);
        if (filter) q = filter(q);
        const { data, error } = await q;
        if (error) throw error;
        const map: Record<string, number> = {};
        (data || []).forEach((p: any) => {
          if (p.category_id) map[p.category_id] = (map[p.category_id] || 0) + 1;
        });
        return map;
      };

      let scope: 'city' | 'state' | 'global' = 'global';
      let countMap: Record<string, number> = {};

      if (city) {
        countMap = await buildMap((q) => q.ilike('city', city));
        if (Object.keys(countMap).length > 0) scope = 'city';
      }
      if (Object.keys(countMap).length === 0 && state) {
        countMap = await buildMap((q) => q.ilike('state', state));
        if (Object.keys(countMap).length > 0) scope = 'state';
      }
      if (Object.keys(countMap).length === 0) {
        countMap = await buildMap();
        scope = 'global';
      }

      const items = cats
        .map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          icon: c.icon,
          parent_id: (c.parent_id as string | null) ?? null,
          count: countMap[c.id] || 0,
        }))
        .filter((c) => c.count > 0);

      return { items, scope };
    },
  });
}
