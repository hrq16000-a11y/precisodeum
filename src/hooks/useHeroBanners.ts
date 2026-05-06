import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HeroBannerData {
  id: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  image_url: string | null;
  overlay_opacity: number;
  text_alignment: string;
  animation_type: string;
  animation_duration: number;
  animation_delay: number;
  display_order: number;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  target_device: string;
  target_city: string | null;
  target_state: string | null;
}

export function useHeroBanners() {
  return useQuery({
    queryKey: ['hero-banners'],
    queryFn: async () => {
      const { data } = await (supabase
        .from('hero_banners' as any)
        .select('*')
        .eq('active', true)
        .order('display_order') as any);

      if (!data || data.length === 0) return [];

      const now = new Date();
      const isMobile = window.innerWidth < 768;

      return (data as HeroBannerData[]).filter(b => {
        if (b.start_date && new Date(b.start_date) > now) return false;
        if (b.end_date && new Date(b.end_date) < now) return false;
        if (b.target_device === 'mobile' && !isMobile) return false;
        if (b.target_device === 'desktop' && isMobile) return false;
        return true;
      });
    },
    staleTime: 1000 * 60 * 2,
  });
}
