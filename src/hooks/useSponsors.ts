import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
}

function isDateValid(s: SponsorFull): boolean {
  const now = new Date().toISOString().split('T')[0];
  if (s.start_date && s.start_date > now) return false;
  if (s.end_date && s.end_date < now) return false;
  return true;
}

/** Fetch sponsors by the new sponsor_type (global/city/category) */
export function useSponsorsByType(type: 'global' | 'city' | 'category', contextValue?: string) {
  return useQuery({
    queryKey: ['sponsors-typed', type, contextValue],
    queryFn: async () => {
      let query = supabase
        .from('sponsors')
        .select('*')
        .eq('active', true)
        .eq('sponsor_type', type)
        .order('display_order');

      if (type === 'city' && contextValue) {
        query = query.eq('linked_city', contextValue);
      }
      if (type === 'category' && contextValue) {
        query = query.eq('linked_category', contextValue);
      }

      const { data } = await query;
      return ((data || []) as unknown as SponsorFull[]).filter(isDateValid).filter(s => s.status === 'active');
    },
    staleTime: 1000 * 60 * 5,
  });
}

/** Fetch all active sponsors for smart placement */
export function useAllActiveSponsors() {
  return useQuery({
    queryKey: ['sponsors-all-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsors')
        .select('*')
        .eq('active', true)
        .order('display_order');
      return ((data || []) as unknown as SponsorFull[]).filter(isDateValid).filter(s => s.status === 'active');
    },
    staleTime: 1000 * 60 * 5,
  });
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
  const { data: sponsors } = useSponsorsByType(type, contextValue);

  const limit = limits?.find(l => 
    l.context_type === type && 
    (l.context_value === (contextValue || '') || l.context_value === '_default')
  );

  const maxSlots = limit?.max_slots ?? (type === 'global' ? 1 : 3);
  const currentCount = sponsors?.length ?? 0;
  const remaining = Math.max(0, maxSlots - currentCount);

  return { maxSlots, currentCount, remaining, isFull: remaining === 0 };
}
