import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGeoCity } from '@/hooks/useGeoCity';
import SponsorImage from '@/components/SponsorImage';

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

/**
 * Geo-targeted sponsor ad component.
 * Uses the get_smart_ads RPC for a single optimized query.
 */
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

const SponsorAdSlot: React.FC<SponsorAdSlotProps> = ({
  locationKey,
  className = '',
  layout = 'banner',
  maxAds,
}) => {
  const { city, state } = useGeoCity();
  const { data: ads = [] } = useSponsorAds(locationKey, city, state);
  const tracked = useRef(new Set<string>());
  const [currentIndex, setCurrentIndex] = useState(0);

  const displayAds = maxAds ? ads.slice(0, maxAds) : ads;

  // Track impressions via IntersectionObserver
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
      { threshold: 0.5 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [displayAds, currentIndex, layout, locationKey]);

  // Rotate banner ads
  useEffect(() => {
    if (layout !== 'banner' || displayAds.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(i => (i + 1) % displayAds.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [displayAds.length, layout]);

  if (displayAds.length === 0) return null;

  const handleClick = (ad: SponsorAd) => {
    trackAdMetric(ad.id, locationKey, 'click');
  };

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
            {ad.image_url && <SponsorImage src={ad.image_url} alt={ad.title} containerClassName="mt-2 rounded-lg" />}
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
            className="block rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Patrocinado</span>
            {ad.image_url && <SponsorImage src={ad.image_url} alt={ad.title} containerClassName="mt-2 rounded-lg" />}
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
            Patrocinado{city ? ` • ${city}` : ''}
          </span>
          <a href={current.link_url || '#'} target="_blank" rel="noopener noreferrer sponsored"
            onClick={() => handleClick(current)} className="block transition-opacity hover:opacity-80" title={current.title}>
            {current.image_url ? (
              <img src={current.image_url} alt={current.title}
                className="w-full object-cover object-center"
                style={{ aspectRatio: '8/1', borderRadius: 10 }} width={1600} height={200} loading="lazy" />
            ) : (
              <div className="flex items-center justify-center bg-card" style={{ aspectRatio: '8/1', borderRadius: 10 }}>
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
