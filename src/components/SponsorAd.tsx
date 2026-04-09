import { useEffect, useRef, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSponsorsBySlot } from '@/hooks/useSponsors';
import SponsorImage from '@/components/SponsorImage';

interface SponsorAdProps {
  position: string;
  className?: string;
  layout?: 'horizontal' | 'vertical' | 'inline';
}

function weightedShuffle<T extends { id: string; tier?: string }>(items: T[]): T[] {
  const weighted = items.flatMap((s) => {
    const tier = s.tier || 'basic';
    const weight = tier === 'premium' ? 5 : tier === 'destaque' ? 3 : 1;
    return Array(weight).fill(s);
  });
  const shuffled = weighted.sort(() => Math.random() - 0.5);
  const seen = new Set<string>();
  return shuffled.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

function trackImpression(id: string) {
  supabase.rpc('increment_sponsor_impression', { sponsor_id: id } as any).then(() => {});
}

function trackClick(id: string) {
  supabase.rpc('increment_sponsor_click', { sponsor_id: id } as any).then(() => {});
}

const SponsorAd = ({ position, className = '', layout = 'horizontal' }: SponsorAdProps) => {
  const { data: rawSponsors = [] } = useSponsorsBySlot(position);
  const sponsors = useMemo(() => weightedShuffle(rawSponsors), [rawSponsors]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const tracked = useRef(new Set<string>());

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % sponsors.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [sponsors.length]);

  useEffect(() => {
    if (sponsors.length === 0) return;
    if (layout === 'vertical' || layout === 'inline') {
      sponsors.forEach((s) => {
        if (!tracked.current.has(s.id)) {
          tracked.current.add(s.id);
          trackImpression(s.id);
        }
      });
    } else {
      const s = sponsors[currentIndex];
      if (s && !tracked.current.has(s.id)) {
        tracked.current.add(s.id);
        trackImpression(s.id);
      }
    }
  }, [sponsors, currentIndex, layout]);

  if (sponsors.length === 0) return null;

  const handleClick = (s: { id: string }) => {
    trackClick(s.id);
  };

  if (layout === 'vertical') {
    return (
      <div className={`space-y-3 ${className}`}>
        {sponsors.map((s) => {
          const visualSrc = s.logo_url || s.image_url;
          return (
            <a
              key={s.id}
              href={s.link_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleClick(s)}
              className="block rounded-xl bg-card p-3 shadow-card transition-all hover:shadow-card-hover"
            >
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Patrocinado</span>
              {visualSrc && (
                <SponsorImage src={visualSrc} alt={s.title} containerClassName="mt-2 rounded-lg" />
              )}
              <p className="mt-2 text-xs font-medium text-foreground">{s.title}</p>
            </a>
          );
        })}
      </div>
    );
  }

  if (layout === 'inline') {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-4 ${className}`}>
        {sponsors.map((s) => {
          const visualSrc = s.logo_url || s.image_url;
          return (
            <a
              key={s.id}
              href={s.link_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleClick(s)}
              className="opacity-60 transition-opacity hover:opacity-100"
              title={s.title}
            >
              {visualSrc ? (
                <img src={visualSrc} alt={s.title} className="h-8 max-w-[140px] object-contain" loading="lazy" />
              ) : (
                <span className="text-xs text-primary-foreground/50">{s.title}</span>
              )}
            </a>
          );
        })}
      </div>
    );
  }

  const current = sponsors[currentIndex] || sponsors[0];
  const currentVisualSrc = current.logo_url || current.image_url;

  return (
    <section className={`py-6 ${className}`}>
      <div className="container">
        <div className="rounded-xl bg-muted/30 p-4 overflow-hidden">
          <span className="mb-2 block text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Patrocinado</span>
          <a
            href={current.link_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleClick(current)}
            className="block transition-opacity hover:opacity-80"
            title={current.title}
          >
            {currentVisualSrc ? (
              <img
                src={currentVisualSrc}
                alt={current.title}
                className="w-full object-cover object-center"
                style={{ aspectRatio: '8/1', borderRadius: 10 }}
                width={1600}
                height={200}
                loading="lazy"
              />
            ) : (
              <div className="flex items-center justify-center bg-card" style={{ aspectRatio: '8/1' }}>
                <span className="text-sm font-medium text-muted-foreground">{current.title}</span>
              </div>
            )}
          </a>
          {sponsors.length > 1 && (
            <div className="mt-2 flex justify-center gap-1">
              {sponsors.map((_, i) => (
                <div key={i} className={`h-1 w-4 rounded-full transition-colors ${i === currentIndex ? 'bg-accent' : 'bg-muted-foreground/20'}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SponsorAd;
