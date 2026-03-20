import { useSponsorsByPosition } from '@/components/SponsorAd';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink } from 'lucide-react';

/** Grid of 250x250 sponsor cards — "Empresas em Destaque" showcase */
const AdShowcase = ({ className = '' }: { className?: string }) => {
  const { data: sponsors = [] } = useSponsorsByPosition('showcase');
  const tracked = useRef(new Set<string>());

  useEffect(() => {
    sponsors.forEach(s => {
      if (!tracked.current.has(s.id)) {
        tracked.current.add(s.id);
        supabase.rpc('increment_sponsor_impression', { sponsor_id: s.id } as any).then(() => {});
      }
    });
  }, [sponsors]);

  if (sponsors.length === 0) return null;

  return (
    <section className={`py-10 ${className}`}>
      <div className="container">
        <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Patrocinadores</p>
        <h2 className="mb-6 text-center font-display text-xl font-bold text-foreground">Empresas em Destaque</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
          {sponsors.slice(0, 8).map(s => (
            <a
              key={s.id}
              href={s.link_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                supabase.rpc('increment_sponsor_click', { sponsor_id: s.id } as any).then(() => {});
              }}
              className="group flex flex-col items-center justify-center rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-lg hover:border-accent/30"
              style={{ aspectRatio: '1/1' }}
            >
              {s.image_url ? (
                <img src={s.image_url} alt={s.title} className="mb-3 h-20 w-20 rounded-lg object-contain" loading="lazy" />
              ) : (
                <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-lg bg-muted text-2xl font-bold text-muted-foreground">
                  {s.title.charAt(0)}
                </div>
              )}
              <p className="text-center text-xs font-semibold text-foreground line-clamp-2 group-hover:text-accent transition-colors">
                {s.title}
              </p>
              {s.link_url && (
                <span className="mt-2 flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-[10px] font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                  Visitar <ExternalLink className="h-3 w-3" />
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AdShowcase;
