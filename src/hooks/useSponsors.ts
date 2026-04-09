import { useQuery } from '@tanstack/react-query';
import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPositionConfig } from '@/config/sponsorPositions';

export interface SponsorFull {
  id: string;
  title: string;
  company_name: string;
  image_url: string | null;
  logo_url: string;
  link_url: string | null;
  external_link: string;
  position: string;
  tier: string;
  plan_tier: string;
  sponsor_type: string;
  short_description: string;
  full_description: string;
  phone: string;
  whatsapp: string;
  linked_city: string;
  linked_category: string;
  badge_type: string;
  status: string;
  active: boolean;
  display_order: number;
  start_date: string | null;
  end_date: string | null;
  impressions: number;
  clicks: number;
  plan: string;
  guaranteed_impressions: number | null;
  delivered_impressions: number;
  campaign_start: string | null;
  campaign_end: string | null;
  needs_compensation: boolean;
}

function isDateValid(s: { start_date?: string | null; end_date?: string | null }): boolean {
  const now = new Date().toISOString().split('T')[0];
  if (s.start_date && s.start_date > now) return false;
  if (s.end_date && s.end_date < now) return false;
  return true;
}

function hasImage(s: { image_url?: string | null; logo_url?: string | null }): boolean {
  return Boolean(s.image_url || s.logo_url);
}

function getPagePath(): string {
  try {
    return window.location.pathname;
  } catch {
    return '/';
  }
}

/**
 * Central hook — single source of truth for fetching sponsors by position.
 * Applies all rules from POSITION_CONFIG automatically:
 * - date validation
 * - status = 'active'
 * - requiresImage filtering
 * - maxItems limit
 * - ordered by display_order
 *
 * Returns centralized trackImpression / trackClick with internal deduplication.
 * Optional filters for future city/category segmentation.
 */
export function useSponsorsBySlot(
  position: string,
  filters?: { city?: string; category?: string }
) {
  const config = getPositionConfig(position);
  const impressionSet = useRef(new Set<string>());

  const query = useQuery({
    queryKey: ['sponsors-slot', position, filters?.city ?? '', filters?.category ?? ''],
    queryFn: async () => {
      let q = supabase
        .from('sponsors')
        .select('*')
        .eq('active', true)
        .eq('position', position)
        .order('display_order');

      if (filters?.city) {
        q = q.eq('linked_city', filters.city);
      }
      if (filters?.category) {
        q = q.eq('linked_category', filters.category);
      }

      const { data } = await q;

      let results = ((data || []) as unknown as SponsorFull[])
        .filter(s => s.status === 'active')
        .filter(isDateValid);

      if (config.requiresImage) {
        results = results.filter(hasImage);
      }

      return results.slice(0, config.maxItems);
    },
    staleTime: 1000 * 60 * 5,
  });

  const trackImpression = useCallback((id: string) => {
    if (impressionSet.current.has(id)) return;
    impressionSet.current.add(id);
    supabase.rpc('track_sponsor_metric', {
      _sponsor_id: id,
      _slot_slug: position,
      _event_type: 'impression',
      _page_path: getPagePath(),
    } as any).then(() => {});
  }, [position]);

  const trackClick = useCallback((id: string) => {
    supabase.rpc('track_sponsor_metric', {
      _sponsor_id: id,
      _slot_slug: position,
      _event_type: 'click',
      _page_path: getPagePath(),
    } as any).then(() => {});
  }, [position]);

  return {
    ...query,
    trackImpression,
    trackClick,
  };
}

/** Fetch slot limits for scarcity display */
export function useSponsorSlotLimits() {
  return useQuery({
    queryKey: ['sponsor-slot-limits'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_slot_limits')
        .select('*');
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

/** Calculate remaining slots for a given context */
export function useRemainingSlots(type: 'global' | 'city' | 'category', contextValue?: string) {
  const { data: limits } = useSponsorSlotLimits();
  const position = type === 'global' ? 'hero-top' : type === 'city' ? 'sidebar' : 'card';
  const config = getPositionConfig(position);
  const { data: sponsors } = useSponsorsBySlot(position);

  const limit = limits?.find(l =>
    l.context_type === type &&
    (l.context_value === (contextValue || '') || l.context_value === '_default')
  );

  const maxSlots = limit?.max_slots ?? config.maxItems;
  const currentCount = sponsors?.length ?? 0;
  const remaining = Math.max(0, maxSlots - currentCount);

  return { maxSlots, currentCount, remaining, isFull: remaining === 0 };
}
