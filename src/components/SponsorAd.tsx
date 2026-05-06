import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useRef, useState, useMemo } from 'react';
import SponsorImage from '@/components/SponsorImage';

interface Sponsor {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  position: string;
  tier?: string;
  start_date?: string | null;
  end_date?: string | null;
}

interface SponsorAdProps {
  position: string;
  className?: string;
  layout?: 'horizontal' | 'vertical' | 'inline';
}

function weightedShuffle(sponsors: Sponsor[]): Sponsor[] {
  const weighted = sponsors.flatMap((s) => {
    const tier = (s as any).tier || 'basic';
    const weight = tier === 'premium' ? 5 : tier === 'destaque' ? 3 : 1;
    return Array(weight).fill(s);
  });
  const shuffled = weighted.sort(() => Math.random() - 0.5);
  // Deduplicate keeping order
  const seen = new Set<string>();
  return shuffled.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

export function useSponsorsByPosition(position: string) {
  return useQuery({
    queryKey: ['sponsors', position],
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsors')
        .select('*')
        .eq('active', true)
        .eq('position', position)
        .order('display_order');
      const now = new Date().toISOString().split('T')[0];
      return ((data || []) as Sponsor[]).filter((s: any) => {
        if (s.start_date && s.start_date > now) return false;
        if (s.end_date && s.end_date < now) return false;
        return true;
      });
    },
    staleTime: 1000 * 60 * 5,
  });
}

function trackImpression(id: string) {
  supabase.rpc('increment_sponsor_impression', { sponsor_id: id } as any).then(() => {});
}

function trackClick(id: string) {
  supabase.rpc('increment_sponsor_click', { sponsor_id: id } as any).then(() => {});
}

const SponsorAd = ({ position, className = '', layout = 'horizontal' }: SponsorAdProps) => {
  const { data: rawSponsors = [] } = useSponsorsByPosition(position);
  const sponsors = useMemo(() => weightedShuffle(rawSponsors), [rawSponsors]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const tracked = useRef(new Set<string>());

  // Rotate for single-display positions
  useEffect(() => {
    if (sponsors.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % sponsors.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [sponsors.length]);

  // Track impression on mount/change
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

  const handleClick = (s: Sponsor) => {
    trackClick(s.id);
  };

  if (layout === 'vertical') {
    return (
      <div className={`space-y-3 ${className}`}>
        {sponsors.map((s) => (
          <a
            key={s.id}
            href={s.link_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleClick(s)}
            className="block rounded-xl bg-card p-3 shadow-card transition-all hover:shadow-card-hover"
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Patrocinado</span>
            {s.image_url && (
              <SponsorImage src={s.image_url} alt={s.title} containerClassName="mt-2 rounded-lg" />
            )}
            <p className="mt-2 text-xs font-medium text-foreground">{s.title}</p>
          </a>
        ))}
      </div>
    );
  }

  if (layout === 'inline') {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-4 ${className}`}>
        {sponsors.map((s) => (
          <a
            key={s.id}
            href={s.link_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleClick(s)}
            className="opacity-60 transition-opacity hover:opacity-100"
            title={s.title}
          >
            {s.image_url ? (
              <img src={s.image_url} alt={s.title} className="h-8 max-w-[140px] object-contain" loading="lazy" />
            ) : (
              <span className="text-xs text-primary-foreground/50">{s.title}</span>
            )}
          </a>
        ))}
      </div>
    );
  }

  // Rotational horizontal (between sections)
  const current = sponsors[currentIndex] || sponsors[0];
  return (
    <section className={`py-6 ${className}`}>
      <div className="container">
        <div className="rounded-xl bg-muted/30 p-4">
          <span className="mb-2 block text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Patrocinado</span>
          <a
            href={current.link_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleClick(current)}
            className="block text-center transition-opacity hover:opacity-80"
            title={current.title}
          >
            {current.image_url ? (
              <SponsorImage src={current.image_url} alt={current.title} containerClassName="mx-auto max-w-[300px] rounded-lg" />
            ) : (
              <span className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground">{current.title}</span>
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
