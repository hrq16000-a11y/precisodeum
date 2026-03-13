import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('site_settings' as any)
        .select('*')
        .order('key');
      const map: Record<string, boolean> = {};
      (data || []).forEach((s: any) => {
        map[s.key] = s.value === 'true';
      });
      return map;
    },
    staleTime: 60000,
  });
}

export function useFeatureEnabled(key: string) {
  const { data: settings } = useSiteSettings();
  return settings?.[key] ?? false;
}
