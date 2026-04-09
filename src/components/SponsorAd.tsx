import { useEffect, useMemo, useState } from 'react';
import { useSponsorsBySlot } from '@/hooks/useSponsors';
import { rankAndOptimise, recordImpression } from '@/lib/sponsorRanking';
import { getPositionConfig } from '@/config/sponsorPositions';
import SponsorImage from '@/components/SponsorImage';

interface SponsorAdProps {
  position: string;
  className?: string;
  layout?: 'horizontal' | 'vertical' | 'inline';
}

const SponsorAd = ({ position, className = '', layout = 'horizontal' }: SponsorAdProps) => {
  const { data: rawSponsors = [], trackImpression, trackClick } = useSponsorsBySlot(position);
  const config = getPositionConfig(position);

  const sponsors = useMemo(
    () => rankAndOptimise(rawSponsors, { maxItems: config.maxItems }),
    [rawSponsors, config.maxItems],
  );

  const [currentIndex, setCurrentIndex] = useState(0);

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
        trackImpression(s.id);
        recordImpression(s.id);
      });
    } else {
      const s = sponsors[currentIndex];
      if (s) {
        trackImpression(s.id);
        recordImpression(s.id);
      }
    }
  }, [sponsors, currentIndex, layout, trackImpression]);

  if (sponsors.length === 0) return null;

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
              onClick={() => trackClick(s.id)}
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
              onClick={() => trackClick(s.id)}
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
            onClick={() => trackClick(current.id)}
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
