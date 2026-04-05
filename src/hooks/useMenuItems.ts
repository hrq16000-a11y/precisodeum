import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MenuItem {
  id: string;
  label: string;
  url: string;
  icon: string;
  menu_location: string;
  parent_id: string | null;
  display_order: number;
  active: boolean;
  open_in_new_tab: boolean;
}

export function useMenuItems(location: string) {
  return useQuery({
    queryKey: ['menu-items', location],
    queryFn: async () => {
      const { data } = await supabase
        .from('menu_items')
        .select('*')
        .eq('menu_location', location)
        .eq('active', true)
        .order('display_order');
      return (data || []) as MenuItem[];
    },
    staleTime: 1000 * 60 * 15,
  });
}

export function useMenuItemsByLocations(locations: string[]) {
  return useQuery({
    queryKey: ['menu-items-multi', locations.join(',')],
    queryFn: async () => {
      const { data } = await supabase
        .from('menu_items')
        .select('*')
        .in('menu_location', locations)
        .eq('active', true)
        .order('display_order');
      const items = (data || []) as MenuItem[];
      const grouped: Record<string, MenuItem[]> = {};
      locations.forEach(loc => { grouped[loc] = []; });
      items.forEach(item => {
        if (!grouped[item.menu_location]) grouped[item.menu_location] = [];
        grouped[item.menu_location].push(item);
      });
      return grouped;
    },
    staleTime: 1000 * 60 * 15,
  });
}
