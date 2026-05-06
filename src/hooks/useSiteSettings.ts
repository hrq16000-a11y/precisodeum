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
      const raw: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        map[s.key] = s.value === 'true';
        raw[s.key] = s.value;
      });
      return { flags: map, values: raw };
    },
    staleTime: 60000,
  });
}

export function useFeatureEnabled(key: string) {
  const { data } = useSiteSettings();
  return data?.flags?.[key] ?? false;
}

export function useSettingValue(key: string) {
  const { data } = useSiteSettings();
  return data?.values?.[key] ?? '';
}
