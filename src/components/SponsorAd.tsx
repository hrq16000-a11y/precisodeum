import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Sponsor {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  position: string;
}

interface SponsorAdProps {
  position: string;
  className?: string;
  layout?: 'horizontal' | 'vertical' | 'inline';
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
      return (data || []) as Sponsor[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

const SponsorAd = ({ position, className = '', layout = 'horizontal' }: SponsorAdProps) => {
  const { data: sponsors = [] } = useSponsorsByPosition(position);

  if (sponsors.length === 0) return null;

  if (layout === 'vertical') {
    return (
      <div className={`space-y-3 ${className}`}>
        {sponsors.map((s) => (
          <a
            key={s.id}
            href={s.link_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-border bg-card p-3 shadow-card transition-all hover:shadow-card-hover"
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Patrocinado</span>
            {s.image_url && (
              <img src={s.image_url} alt={s.title} className="mt-2 w-full rounded-lg object-cover" loading="lazy" />
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

  // horizontal (between sections)
  return (
    <section className={`py-6 ${className}`}>
      <div className="container">
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <span className="mb-2 block text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Patrocinado</span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {sponsors.map((s) => (
              <a
                key={s.id}
                href={s.link_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="block transition-opacity hover:opacity-80"
                title={s.title}
              >
                {s.image_url ? (
                  <img src={s.image_url} alt={s.title} className="h-16 max-w-[240px] rounded-lg object-contain" loading="lazy" />
                ) : (
                  <span className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground">{s.title}</span>
                )}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SponsorAd;