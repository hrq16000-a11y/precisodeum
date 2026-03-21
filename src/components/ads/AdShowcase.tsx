import { useSponsorsByPosition } from '@/components/SponsorAd';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import SponsorImage from '@/components/SponsorImage';

/** Full-width carousel showcase — no labels, big visuals */
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

  useEffect(() => {
    if (!isMobile || sponsors.length <= 1) return;
    const iv = setInterval(() => setIdx(i => (i + 1) % sponsors.length), 5000);
    return () => clearInterval(iv);
  }, [isMobile, sponsors.length]);

  if (sponsors.length === 0) return null;

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
              <SponsorImage
                src={current.image_url}
                alt={current.title}
                forceAspectRatio="16/9"
                containerClassName="rounded-2xl"
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
                <SponsorImage
                  src={s.image_url}
                  alt={s.title}
                  forceAspectRatio="4/3"
                  containerClassName="transition-transform group-hover:scale-105"
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
