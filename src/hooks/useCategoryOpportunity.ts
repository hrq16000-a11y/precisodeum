import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryOpportunityConfig {
  id: string;
  category_slug: string;
  enabled: boolean;
  headline: string | null;
  subheadline: string | null;
  body_text: string | null;
  cta_pro_label: string | null;
  cta_sponsor_label: string | null;
  banner_url: string | null;
}

/** Configuração admin da página de oportunidade de uma categoria. */
export function useCategoryOpportunity(categorySlug?: string | null) {
  return useQuery({
    queryKey: ['category-opportunity', categorySlug || ''],
    enabled: !!categorySlug,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<CategoryOpportunityConfig | null> => {
      const { data, error } = await supabase
        .from('category_opportunities')
        .select('id, category_slug, enabled, headline, subheadline, body_text, cta_pro_label, cta_sponsor_label, banner_url')
        .eq('category_slug', categorySlug!)
        .maybeSingle();
      if (error) return null;
      return (data as CategoryOpportunityConfig) ?? null;
    },
  });
}
