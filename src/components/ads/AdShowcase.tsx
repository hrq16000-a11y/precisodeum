import { useSponsorsByPosition } from '@/components/SponsorAd';
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleImageError } from '@/lib/imageResolver';
import { ExternalLink } from 'lucide-react';

interface ShowcaseSponsor {
  id: string;
  title: string;
  company_name?: string;
  short_description?: string;
  image_url: string | null;
  link_url: string | null;
  position: string;
  tier?: string;
}

/** Full-width showcase with professional card layout */
const AdShowcase = ({ className = '' }: { className?: string }) => {
  const { data: rawSponsors = [] } = useSponsorsByPosition('showcase');
  const sponsors = rawSponsors as unknown as ShowcaseSponsor[];
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

  const handleClick = (id: string) => {
    supabase.rpc('increment_sponsor_click', { sponsor_id: id } as any);
  };

  // Determine grid layout based on count
  const gridCols = sponsors.length === 1
    ? 'grid-cols-1'
    : sponsors.length === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section className={`py-8 ${className}`}>
      <div className="container px-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-accent" />
            <h3 className="font-display text-sm font-bold text-foreground sm:text-base">Destaques</h3>
          </div>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Publicidade
          </span>
        </div>

        {/* Desktop: professional grid */}
        <div className={`hidden sm:grid ${gridCols} gap-4`}>
          {sponsors.slice(0, 6).map((s) => (
            <a
              key={s.id}
              href={s.link_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleClick(s.id)}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              {/* Image area — fixed aspect ratio, no gaps */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted/20">
                {s.image_url ? (
                  <img
                    src={s.image_url}
                    alt={s.title}
                    loading="lazy"
                    onError={handleImageError}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                    <span className="text-2xl font-bold text-muted-foreground/50">{s.title}</span>
                  </div>
                )}
                {/* Tier badge */}
                {s.tier === 'premium' && (
                  <span className="absolute top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground shadow-sm">
                    Premium
                  </span>
                )}
              </div>

              {/* Info bar */}
              <div className="flex items-center justify-between border-t border-border/60 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {s.company_name || s.title}
                  </p>
                  {s.short_description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.short_description}
                    </p>
                  )}
                </div>
                <ExternalLink className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-accent" />
              </div>
            </a>
          ))}
        </div>

        {/* Mobile: swipe carousel */}
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
                  onClick={() => handleClick(current.id)}
                  className="group block overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted/20">
                    {current.image_url ? (
                      <img
                        src={current.image_url}
                        alt={current.title}
                        loading="lazy"
                        onError={handleImageError}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                        <span className="text-lg font-bold text-muted-foreground">{current.title}</span>
                      </div>
                    )}
                    {current.tier === 'premium' && (
                      <span className="absolute top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground">
                        Premium
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-border/60 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {current.company_name || current.title}
                      </p>
                      {current.short_description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {current.short_description}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  </div>
                </a>
                {sponsors.length > 1 && (
                  <div className="mt-3 flex justify-center gap-1.5">
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
