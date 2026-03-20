import { useSponsorsByPosition } from '@/components/SponsorAd';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

/** Full-width carousel showcase — no labels, big visuals, crop-center */
const AdShowcase = ({ className = '' }: { className?: string }) => {
  const { data: sponsors = [] } = useSponsorsByPosition('showcase');
  const tracked = useRef(new Set<string>());
  const isMobile = useIsMobile();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    sponsors.forEach(s => {
      if (!tracked.current.has(s.id)) {
        tracked.current.add(s.id);
        supabase.rpc('increment_sponsor_impression', { sponsor_id: s.id } as any).then(() => {});
      }
    });
  }, [sponsors]);

  // Auto-rotate on mobile (carousel)
  useEffect(() => {
    if (!isMobile || sponsors.length <= 1) return;
    const iv = setInterval(() => setIdx(i => (i + 1) % sponsors.length), 5000);
    return () => clearInterval(iv);
  }, [isMobile, sponsors.length]);

  if (sponsors.length === 0) return null;

  // Mobile: single carousel card
  if (isMobile) {
    const current = sponsors[idx] || sponsors[0];
    return (
      <section className={`py-6 ${className}`}>
        <div className="container px-4">
          <a
            href={current.link_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => supabase.rpc('increment_sponsor_click', { sponsor_id: current.id } as any)}
            className="block overflow-hidden rounded-2xl border border-border shadow-card transition-shadow hover:shadow-lg"
          >
            {current.image_url ? (
              <img
                src={current.image_url}
                alt={current.title}
                className="w-full object-cover"
                style={{ aspectRatio: '16/9', minHeight: '160px' }}
                loading="lazy"
              />
            ) : (
              <div className="flex items-center justify-center bg-muted/30 p-8" style={{ aspectRatio: '16/9' }}>
                <span className="text-lg font-bold text-muted-foreground">{current.title}</span>
              </div>
            )}
          </a>
          {sponsors.length > 1 && (
            <div className="mt-3 flex justify-center gap-1">
              {sponsors.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-accent' : 'w-3 bg-muted-foreground/20'}`} />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Desktop: grid of big cards, no labels
  return (
    <section className={`py-10 ${className}`}>
      <div className="container">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {sponsors.slice(0, 8).map(s => (
            <a
              key={s.id}
              href={s.link_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => supabase.rpc('increment_sponsor_click', { sponsor_id: s.id } as any)}
              className="group overflow-hidden rounded-2xl border border-border shadow-card transition-all hover:shadow-lg hover:scale-[1.02]"
            >
              {s.image_url ? (
                <img
                  src={s.image_url}
                  alt={s.title}
                  className="w-full object-cover object-center transition-transform group-hover:scale-105"
                  style={{ aspectRatio: '4/3', minHeight: '180px' }}
                  loading="lazy"
                />
              ) : (
                <div className="flex items-center justify-center bg-muted/20 p-6" style={{ aspectRatio: '4/3' }}>
                  <span className="text-xl font-bold text-muted-foreground">{s.title}</span>
                </div>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AdShowcase;
