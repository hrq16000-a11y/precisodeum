import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useAuth } from '@/hooks/useAuth';
import { useAdDebug } from '@/contexts/AdDebugContext';
import SponsorImage from '@/components/SponsorImage';
import { Skeleton } from '@/components/ui/skeleton';

interface SponsorAd {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  company_name: string | null;
  priority: number;
}

interface SponsorAdSlotProps {
  locationKey: string;
  className?: string;
  layout?: 'banner' | 'inline' | 'sidebar' | 'card';
  maxAds?: number;
}

/* ─── Aspect ratios per layout ─── */
const ASPECT_RATIOS: Record<string, string> = {
  banner: '8 / 1',
  inline: 'auto',
  sidebar: '6 / 5',
  card: '3 / 2',
};

/* ─── Ideal dimensions map ─── */
const IDEAL_DIMS: Record<string, string> = {
  banner: '728×90',
  inline: '468×60',
  sidebar: '300×250',
  card: '600×400',
};

/* ─── Data hook ─── */
function useSponsorAds(locationKey: string, city: string | null, state: string | null) {
  return useQuery({
    queryKey: ['sponsor-ad-slot', locationKey, city, state],
    queryFn: async (): Promise<SponsorAd[]> => {
      const { data, error } = await (supabase.rpc as any)('get_smart_ads', {
        _location_key: locationKey,
        _visitor_city: city || '',
        _visitor_state: state || '',
      } as any);
      if (error || !data) return [];
      return (data as any[]).map(row => ({
        id: row.id,
        title: row.title,
        image_url: row.image_url,
        link_url: row.link_url,
        company_name: row.company_name,
        priority: row.priority || 0,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

function trackAdMetric(sponsorId: string, slotSlug: string, eventType: 'impression' | 'click') {
  supabase.rpc('track_sponsor_metric', {
    _sponsor_id: sponsorId,
    _slot_slug: slotSlug,
    _event_type: eventType,
    _page_path: typeof window !== 'undefined' ? window.location.pathname : '/',
  } as any).then(() => {});
}

/* ─── X-Ray placeholder (admin debug mode) ─── */
const XRaySlot: React.FC<{ locationKey: string; layout: string; hasAds: boolean; adCount: number }> = ({ locationKey, layout, hasAds, adCount }) => {
  const ar = ASPECT_RATIOS[layout] || ASPECT_RATIOS.banner;
  const dims = IDEAL_DIMS[layout] || '728×90';
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-xl border-2 border-primary/40 overflow-hidden"
      style={{
        aspectRatio: ar === 'auto' ? '16 / 3' : ar,
        minHeight: layout === 'inline' ? 48 : 70,
        background: 'linear-gradient(135deg, hsl(217 91% 60% / 0.08), hsl(199 89% 48% / 0.12))',
        boxShadow: '0 0 20px hsl(217 91% 60% / 0.15), inset 0 0 30px hsl(217 91% 60% / 0.05)',
      }}
    >
      {/* Pulsing glow border */}
      <div className="absolute inset-0 rounded-xl border-2 border-primary/20 animate-pulse pointer-events-none" />

      <div className="flex flex-col items-center gap-1 px-4 text-center z-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold text-primary tracking-wide uppercase">
          📡 Raio-X
        </span>
        <span className="text-xs font-semibold text-foreground/80">{locationKey}</span>
        <span className="text-[10px] text-muted-foreground">
          {dims} · {layout}
          {hasAds ? ` · ${adCount} anúncio(s) ativo(s)` : ' · Vazio'}
        </span>
      </div>
    </div>
  );
};

/* ─── Ghost placeholder for admins (no X-Ray) ─── */
const GhostSlot: React.FC<{ locationKey: string; layout: string }> = ({ locationKey, layout }) => {
  const ar = ASPECT_RATIOS[layout] || ASPECT_RATIOS.banner;
  return (
    <div
      className="flex items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/10 text-muted-foreground/50"
      style={{ aspectRatio: ar === 'auto' ? undefined : ar, minHeight: layout === 'inline' ? 48 : 60 }}
    >
      <span className="text-xs font-mono select-none px-4 text-center">
        Espaço Disponível: <strong className="text-muted-foreground/70">{locationKey}</strong>
      </span>
    </div>
  );
};

/* ─── Skeleton loader ─── */
const AdSkeleton: React.FC<{ layout: string }> = ({ layout }) => {
  const ar = ASPECT_RATIOS[layout] || ASPECT_RATIOS.banner;
  return (
    <div className="rounded-xl overflow-hidden">
      <Skeleton className="w-full" style={{ aspectRatio: ar === 'auto' ? '16 / 3' : ar }} />
    </div>
  );
};

/* ═══ Main component ═══ */
const SponsorAdSlot: React.FC<SponsorAdSlotProps> = ({
  locationKey,
  className = '',
  layout = 'banner',
  maxAds,
}) => {
  const { city: geoCity, state: geoState } = useGeoCity();
  const { xrayEnabled, simulatedCity, simulatedState } = useAdDebug();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Use simulated location if admin has set one, otherwise real geo
  const effectiveCity = (isAdmin && simulatedCity) ? simulatedCity : geoCity;
  const effectiveState = (isAdmin && simulatedState) ? simulatedState : geoState;

  const { data: ads = [], isLoading } = useSponsorAds(locationKey, effectiveCity, effectiveState);
  const tracked = useRef(new Set<string>());
  const [currentIndex, setCurrentIndex] = useState(0);

  const displayAds = maxAds ? ads.slice(0, maxAds) : ads;
  const ar = ASPECT_RATIOS[layout] || ASPECT_RATIOS.banner;

  // Intersection-based impression tracking
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (displayAds.length === 0 || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const adsToTrack = layout === 'banner' ? [displayAds[currentIndex]] : displayAds;
            adsToTrack.forEach(ad => {
              if (ad && !tracked.current.has(ad.id)) {
                tracked.current.add(ad.id);
                trackAdMetric(ad.id, locationKey, 'impression');
              }
            });
          }
        });
      },
      { threshold: 0.5 },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [displayAds, currentIndex, layout, locationKey]);

  // Rotate banner ads
  useEffect(() => {
    if (layout !== 'banner' || displayAds.length <= 1) return;
    const interval = setInterval(() => setCurrentIndex(i => (i + 1) % displayAds.length), 8000);
    return () => clearInterval(interval);
  }, [displayAds.length, layout]);

  // X-Ray mode: always show the debug overlay for admins
  if (isAdmin && xrayEnabled) {
    return (
      <div className={className}>
        <XRaySlot locationKey={locationKey} layout={layout} hasAds={displayAds.length > 0} adCount={displayAds.length} />
      </div>
    );
  }

  // Loading state
  if (isLoading) return <AdSkeleton layout={layout} />;

  // Ghost mode for admins when no ads (non-X-Ray)
  if (displayAds.length === 0) {
    if (isAdmin) return <GhostSlot locationKey={locationKey} layout={layout} />;
    return null;
  }

  const handleClick = (ad: SponsorAd) => trackAdMetric(ad.id, locationKey, 'click');

  // Inline layout
  if (layout === 'inline') {
    return (
      <div ref={containerRef} className={`flex flex-wrap items-center justify-center gap-4 py-3 ${className}`}>
        {displayAds.map(ad => (
          <a key={ad.id} href={ad.link_url || '#'} target="_blank" rel="noopener noreferrer sponsored"
            onClick={() => handleClick(ad)} className="opacity-60 transition-opacity hover:opacity-100" title={ad.title}>
            {ad.image_url ? (
              <img src={ad.image_url} alt={ad.title} className="h-8 max-w-[140px] object-contain" loading="lazy" />
            ) : (
              <span className="text-xs text-muted-foreground">{ad.title}</span>
            )}
          </a>
        ))}
      </div>
    );
  }

  // Sidebar layout
  if (layout === 'sidebar') {
    return (
      <div ref={containerRef} className={`space-y-3 ${className}`}>
        {displayAds.map(ad => (
          <a key={ad.id} href={ad.link_url || '#'} target="_blank" rel="noopener noreferrer sponsored"
            onClick={() => handleClick(ad)}
            className="block rounded-xl bg-card p-3 shadow-sm transition-all hover:shadow-md border border-border">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Patrocinado</span>
            {ad.image_url && (
              <div className="mt-2 rounded-lg overflow-hidden" style={{ aspectRatio: ar }}>
                <SponsorImage src={ad.image_url} alt={ad.title} containerClassName="h-full w-full" />
              </div>
            )}
            <p className="mt-2 text-xs font-medium text-foreground">{ad.title}</p>
          </a>
        ))}
      </div>
    );
  }

  // Card layout
  if (layout === 'card') {
    return (
      <div ref={containerRef} className={className}>
        {displayAds.slice(0, 1).map(ad => (
          <a key={ad.id} href={ad.link_url || '#'} target="_blank" rel="noopener noreferrer sponsored"
            onClick={() => handleClick(ad)}
            className="block rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md shadow-sm">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Patrocinado</span>
            {ad.image_url && (
              <div className="mt-2 rounded-lg overflow-hidden" style={{ aspectRatio: ar }}>
                <img src={ad.image_url} alt={ad.title} className="h-full w-full object-cover" loading="lazy" />
              </div>
            )}
            <p className="mt-2 text-sm font-medium text-foreground">{ad.title}</p>
            {ad.company_name && <p className="text-xs text-muted-foreground">{ad.company_name}</p>}
          </a>
        ))}
      </div>
    );
  }

  // Banner layout (default — rotational)
  const current = displayAds[currentIndex] || displayAds[0];
  if (!current) return null;

  return (
    <section ref={containerRef} className={`py-4 ${className}`}>
      <div className="container mx-auto px-4">
        <div className="rounded-xl bg-muted/30 p-3 overflow-hidden">
          <span className="mb-2 block text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Patrocinado{effectiveCity ? ` • ${effectiveCity}` : ''}
          </span>
          <a href={current.link_url || '#'} target="_blank" rel="noopener noreferrer sponsored"
            onClick={() => handleClick(current)} className="block transition-opacity hover:opacity-80" title={current.title}>
            {current.image_url ? (
              <img src={current.image_url} alt={current.title}
                className="w-full rounded-[10px] object-cover object-center"
                style={{ aspectRatio: ar }} width={1600} height={200} loading="lazy" />
            ) : (
              <div className="flex items-center justify-center rounded-[10px] bg-card" style={{ aspectRatio: ar }}>
                <span className="text-sm font-medium text-muted-foreground">{current.title}</span>
              </div>
            )}
          </a>
          {displayAds.length > 1 && (
            <div className="mt-2 flex justify-center gap-1">
              {displayAds.map((_, i) => (
                <button key={i} onClick={() => setCurrentIndex(i)}
                  className={`h-1.5 w-4 rounded-full transition-colors ${i === currentIndex ? 'bg-accent' : 'bg-muted-foreground/20'}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SponsorAdSlot;
