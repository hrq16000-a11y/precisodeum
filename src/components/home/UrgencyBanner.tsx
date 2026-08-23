import { memo, useEffect, useState } from 'react';
import { TrendingUp, Clock } from 'lucide-react';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { canTriggerMarketingPopup } from '@/lib/popupGuards';

const UrgencyBanner = memo(() => {
  const [visible, setVisible] = useState(false);

  // Admin-configurable texts via site_settings
  const customMainText = useSettingValue('urgency_main_text');
  const customSubText = useSettingValue('urgency_sub_text');
  const customCtaText = useSettingValue('urgency_cta_text');
  const customCtaLink = useSettingValue('urgency_cta_link');

  const { data: recentCount = 0 } = useQuery({
    queryKey: ['urgency-recent-leads'],
    queryFn: async () => {
      const since = new Date();
      since.setHours(since.getHours() - 24);
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'estimated', head: true })
        .gte('created_at', since.toISOString());
      return count || 0;
    },
    staleTime: 1000 * 60 * 15,
  });

  useEffect(() => {
    const mountedAt = Date.now();
    let raf = 0;
    const tryShow = () => {
      if (canTriggerMarketingPopup(mountedAt)) {
        setVisible(true);
        cleanup();
      }
    };
    const cleanup = () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
      window.clearInterval(interval);
    };
    const onScroll = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(tryShow);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Poll leve (a cada 1.5s) para honrar minTimeMs sem depender só de scroll.
    const interval = window.setInterval(tryShow, 1500);
    return cleanup;
  }, []);

  if (recentCount === 0) return null;

  const mainText = customMainText || `${recentCount} solicitações nas últimas 24h`;
  const subText = customSubText || 'Profissionais respondendo agora';
  const ctaText = customCtaText || 'Cadastre-se grátis';
  const ctaLink = customCtaLink || '/cadastro';

  return (
    <div
      className={`bg-gradient-to-r from-accent/10 via-accent/5 to-accent/10 border-y border-accent/20 transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="container flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 animate-pulse">
            <TrendingUp className="h-4 w-4 text-accent" />
          </div>
          <div className="text-sm">
            <span className="font-bold text-foreground">{mainText.includes('{count}') ? mainText.replace('{count}', String(recentCount)) : mainText}</span>
          </div>
          <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Clock className="h-3 w-3" />
            {subText}
          </div>
        </div>
        <Button variant="accent" size="sm" className="rounded-full text-xs shadow-xs" asChild>
          <Link to={ctaLink}>{ctaText}</Link>
        </Button>
      </div>
    </div>
  );
});

UrgencyBanner.displayName = 'UrgencyBanner';

export default UrgencyBanner;
