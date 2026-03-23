import { useSponsorsByPosition } from '@/components/SponsorAd';
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import SponsorImage from '@/components/SponsorImage';

/** Full-width carousel showcase with touch swipe */
const AdShowcase = ({ className = '' }: { className?: string }) => {
  const { data: sponsors = [] } = useSponsorsByPosition('showcase');
  const tracked = useRef(new Set<string>());
  const [idx, setIdx] = useState(0);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    sponsors.forEach(s => {
      if (!tracked.current.has(s.id)) {
        tracked.current.add(s.id);
        supabase.rpc('increment_sponsor_impression', { sponsor_id: s.id } as any).then(() => {});
      }
    });
  }, [sponsors]);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const iv = setInterval(() => setIdx(i => (i + 1) % sponsors.length), 5000);
    return () => clearInterval(iv);
  }, [sponsors.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStart.current === null || sponsors.length <= 1) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setIdx(i => diff > 0 ? (i + 1) % sponsors.length : (i - 1 + sponsors.length) % sponsors.length);
    }
    touchStart.current = null;
  }, [sponsors.length]);

  if (sponsors.length === 0) return null;

  return (
    <section className={`py-10 ${className}`}>
      <div className="container">
        {/* Desktop: grid */}
        <div className="hidden sm:grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {sponsors.slice(0, 8).map((s) => (
            <a
              key={s.id}
              href={s.link_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => supabase.rpc('increment_sponsor_click', { sponsor_id: s.id } as any)}
              className="group rounded-2xl shadow-card transition-all hover:shadow-lg hover:scale-[1.02]"
            >
              {s.image_url ? (
                <SponsorImage src={s.image_url} alt={s.title} />
              ) : (
                <div className="flex items-center justify-center bg-muted/20 p-6 min-h-[120px]">
                  <span className="text-xl font-bold text-muted-foreground">{s.title}</span>
                </div>
              )}
            </a>
          ))}
        </div>

        {/* Mobile: touch swipe carousel */}
        <div
          className="sm:hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {(() => {
            const current = sponsors[idx] || sponsors[0];
            return (
              <>
                <a
                  href={current.link_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => supabase.rpc('increment_sponsor_click', { sponsor_id: current.id } as any)}
                  className="block rounded-2xl shadow-card"
                >
                  {current.image_url ? (
                    <SponsorImage src={current.image_url} alt={current.title} />
                  ) : (
                    <div className="flex items-center justify-center bg-muted/30 p-8 min-h-[120px]">
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
              </>
            );
          })()}
        </div>
      </div>
    </section>
  );
};

export default AdShowcase;
