import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PinnedSponsor {
  sponsor_id: string;
  title: string;
  company_name: string;
  image_url: string | null;
  logo_url: string | null;
  link_url: string | null;
  short_description: string | null;
  whatsapp: string | null;
  phone: string | null;
  assignment_id: string;
}

/**
 * Returns the pinned (Categoria Exclusiva) sponsor for the search context.
 * The DB function picks the most specific match among category/city/state.
 */
export function usePinnedSponsor(params: {
  categorySlug?: string;
  city?: string;
  state?: string;
  enabled?: boolean;
}) {
  const { categorySlug, city, state, enabled = true } = params;
  const impressionTracked = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ['pinned-sponsor', categorySlug || '', city || '', state || ''],
    enabled,
    queryFn: async (): Promise<PinnedSponsor | null> => {
      const { data, error } = await supabase.rpc('get_pinned_sponsor_for_search', {
        _category_slug: categorySlug || null,
        _city: city || null,
        _state: state || null,
      } as any);
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as PinnedSponsor) ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const trackImpression = useCallback((sponsorId: string) => {
    if (impressionTracked.current === sponsorId) return;
    impressionTracked.current = sponsorId;
    supabase.rpc('track_sponsor_metric', {
      _sponsor_id: sponsorId,
      _slot_slug: 'search-pinned',
      _event_type: 'impression',
      _page_path: typeof window !== 'undefined' ? window.location.pathname : '/',
    } as any).then(() => {});
  }, []);

  const trackClick = useCallback((sponsorId: string) => {
    supabase.rpc('track_sponsor_metric', {
      _sponsor_id: sponsorId,
      _slot_slug: 'search-pinned',
      _event_type: 'click',
      _page_path: typeof window !== 'undefined' ? window.location.pathname : '/',
    } as any).then(() => {});
  }, []);

  return { ...query, trackImpression, trackClick };
}
