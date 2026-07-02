import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BottomNavConfig {
  id: string;
  is_active: boolean;
  layout_type: string;
  background_color: string;
  border_color: string;
  shadow: boolean;
  blur: boolean;
  height: number;
  padding: number;
  animation_type: string;
  animation_duration: number;
  mobile_only: boolean;
  hidden_paths: string[];
}

export interface BottomNavItem {
  id: string;
  config_id: string;
  label: string;
  icon: string;
  icon_active: string;
  route_path: string;
  external_url: string;
  action_type: 'route' | 'external' | 'modal' | 'function';
  order_index: number;
  is_active: boolean;
  badge: string;
  badge_color: string;
  text_color: string;
  active_color: string;
  background_color: string;
  border_radius: string;
  size: string;
  animation: string;
  requires_auth: boolean;
}

export interface BottomNavData {
  config: BottomNavConfig | null;
  items: BottomNavItem[];
}

async function fetchBottomNav(): Promise<BottomNavData> {
  // Get active config
  const { data: configs, error: configError } = await supabase
    .from('ui_bottom_nav_config')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (configError || !configs || configs.length === 0) {
    return { config: null, items: [] };
  }

  const config = configs[0] as any;

  // Get active items for this config
  const { data: items, error: itemsError } = await supabase
    .from('ui_bottom_nav_items')
    .select('*')
    .eq('config_id', config.id)
    .eq('is_active', true)
    .order('order_index', { ascending: true });

  if (itemsError) {
    return { config: config as BottomNavConfig, items: [] };
  }

  return {
    config: {
      ...config,
      hidden_paths: Array.isArray(config.hidden_paths) ? config.hidden_paths : [],
    } as BottomNavConfig,
    items: (items || []) as BottomNavItem[],
  };
}

export function useBottomNav() {
  const { data, isLoading } = useQuery({
    queryKey: ['bottom-nav-config'],
    queryFn: fetchBottomNav,
    staleTime: 1000 * 60 * 10, // 10 min cache
    gcTime: 1000 * 60 * 30,
  });

  return {
    config: data?.config ?? null,
    items: data?.items ?? [],
    isLoading,
    useFallback: !data?.config || (data?.items?.length ?? 0) < 2,
  };
}
