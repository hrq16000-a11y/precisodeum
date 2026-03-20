import { useSponsorsByPosition } from '@/components/SponsorAd';
import { useEffect, useRef, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

interface AdBannerProps {
  position: string;
  className?: string;
  maxWidth?: number;
  aspectRatio?: string; // e.g. "970/90"
  sticky?: boolean;
}

function trackImpression(id: string) {
  supabase.rpc('increment_sponsor_impression', { sponsor_id: id } as any).then(() => {});
}
function trackClick(id: string) {
  supabase.rpc('increment_sponsor_click', { sponsor_id: id } as any).then(() => {});
}

const AdBanner = ({ position, className = '', maxWidth, aspectRatio, sticky = false }: AdBannerProps) => {
  const { data: sponsors = [] } = useSponsorsByPosition(position);
  const [idx, setIdx] = useState(0);
  const tracked = useRef(new Set<string>());
  const isMobile = useIsMobile();

  // Rotate
  useEffect(() => {
    if (sponsors.length <= 1) return;
    const iv = setInterval(() => setIdx(i => (i + 1) % sponsors.length), 8000);
    return () => clearInterval(iv);
  }, [sponsors.length]);

  // Track impression
  useEffect(() => {
    const s = sponsors[idx];
    if (s && !tracked.current.has(s.id)) {
      tracked.current.add(s.id);
      trackImpression(s.id);
    }
  }, [sponsors, idx]);

  if (sponsors.length === 0) return null;
  const current = sponsors[idx] || sponsors[0];

  const wrapperClass = sticky && !isMobile ? 'sticky top-4' : '';

  return (
    <div className={`${wrapperClass} ${className}`} style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined }}>
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted/20">
        <span className="absolute left-2 top-1.5 z-10 rounded bg-background/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
          Patrocinado
        </span>
        <a
          href={current.link_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackClick(current.id)}
          className="block transition-opacity hover:opacity-90"
        >
          {current.image_url ? (
            <img
              src={current.image_url}
              alt={current.title}
              className="w-full object-cover"
              style={{ aspectRatio: aspectRatio || 'auto' }}
              loading="lazy"
            />
          ) : (
            <div
              className="flex items-center justify-center bg-muted/30 p-4"
              style={{ aspectRatio: aspectRatio || '728/90' }}
            >
              <span className="text-sm font-medium text-muted-foreground">{current.title}</span>
            </div>
          )}
        </a>
        {sponsors.length > 1 && (
          <div className="absolute bottom-1.5 right-2 flex gap-0.5">
            {sponsors.map((_, i) => (
              <div key={i} className={`h-1 w-3 rounded-full transition-colors ${i === idx ? 'bg-accent' : 'bg-muted-foreground/20'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdBanner;
