import { useSponsorsByPosition } from '@/components/SponsorAd';
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import SponsorImage from '@/components/SponsorImage';

interface AdBannerProps {
  position: string;
  className?: string;
  maxWidth?: number;
  sticky?: boolean;
}

function trackImpression(id: string) {
  supabase.rpc('increment_sponsor_impression', { sponsor_id: id } as any).then(() => {});
}
function trackClick(id: string) {
  supabase.rpc('increment_sponsor_click', { sponsor_id: id } as any).then(() => {});
}

const AdBanner = ({ position, className = '', maxWidth, sticky = false }: AdBannerProps) => {
  const { data: sponsors = [] } = useSponsorsByPosition(position);
  const [idx, setIdx] = useState(0);
  const tracked = useRef(new Set<string>());
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const iv = setInterval(() => setIdx(i => (i + 1) % sponsors.length), 8000);
    return () => clearInterval(iv);
  }, [sponsors.length]);

  useEffect(() => {
    const s = sponsors[idx];
    if (s && !tracked.current.has(s.id)) {
      tracked.current.add(s.id);
      trackImpression(s.id);
    }
  }, [sponsors, idx]);

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
  const current = sponsors[idx] || sponsors[0];

  const wrapperClass = sticky ? 'lg:sticky lg:top-4' : '';

  return (
    <div
      className={`${wrapperClass} ${className}`}
      style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative rounded-2xl bg-muted/10 shadow-card">
        <span className="absolute left-2 top-1.5 z-20 rounded-md bg-background/70 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/60 backdrop-blur-sm">
          Anúncio
        </span>
        <a
          href={current.link_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackClick(current.id)}
          className="block transition-opacity hover:opacity-95"
        >
          {current.image_url ? (
            <SponsorImage src={current.image_url} alt={current.title} />
          ) : (
            <div className="flex items-center justify-center bg-muted/20 p-4 min-h-[60px]">
              <span className="text-sm font-medium text-muted-foreground">{current.title}</span>
            </div>
          )}
        </a>
        {sponsors.length > 1 && (
          <div className="absolute bottom-1.5 right-2 z-20 flex gap-0.5">
            {sponsors.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1.5 w-3 rounded-full transition-colors ${i === idx ? 'bg-accent' : 'bg-muted-foreground/15'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdBanner;
