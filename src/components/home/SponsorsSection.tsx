import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import SponsorImage from '@/components/SponsorImage';
import { handleImageError } from '@/lib/imageResolver';

interface Sponsor {
  id: string;
  title: string;
  company_name?: string;
  image_url: string | null;
  logo_url?: string | null;
  link_url: string | null;
  position: string;
  tier?: string;
  ad_format?: string;
  max_width?: number;
  max_height?: number;
  short_description?: string;
}

interface Props {
  sponsors: Sponsor[];
}

function trackMetric(sponsorId: string, eventType: 'impression' | 'click') {
  supabase.rpc('track_sponsor_metric', {
    _sponsor_id: sponsorId,
    _slot_slug: 'home-sponsors',
    _event_type: eventType,
    _page_path: window.location.pathname,
  } as any).then(() => {});
}

const SponsorsSection = ({ sponsors }: Props) => {
  const visibleSponsors = sponsors.filter(s => s.position === 'banner' || s.position === 'card' || s.position === 'featured');
  const tracked = useRef(new Set<string>());

  useEffect(() => {
    visibleSponsors.forEach(s => {
      if (!tracked.current.has(s.id)) {
        tracked.current.add(s.id);
        trackMetric(s.id, 'impression');
      }
    });
  }, [visibleSponsors]);

  if (visibleSponsors.length === 0) return null;

  const tierOrder: Record<string, number> = { premium: 0, destaque: 1, basic: 2 };
  const sorted = [...visibleSponsors].sort((a, b) => (tierOrder[a.tier || 'basic'] ?? 2) - (tierOrder[b.tier || 'basic'] ?? 2));

  // Detect if sponsor uses a logo-style image (clearbit, small logo, etc.)
  const isLogoStyle = (url: string | null) => {
    if (!url) return false;
    return url.includes('logo.clearbit.com') || url.includes('logo') || url.endsWith('.svg');
  };

  return (
    <section className="py-8">
      <div className="container">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">Parceiros & Patrocinadores</h2>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Publicidade</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((sponsor) => {
            const style: React.CSSProperties = {};
            if (sponsor.max_width && sponsor.max_width > 0) style.maxWidth = `${sponsor.max_width}px`;
            if (sponsor.max_height && sponsor.max_height > 0) style.maxHeight = `${sponsor.max_height}px`;
            const logoStyle = isLogoStyle(sponsor.image_url);

            return (
              <a
                key={sponsor.id}
                href={sponsor.link_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackMetric(sponsor.id, 'click')}
                className="group relative flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-lg hover:scale-[1.02] hover:border-accent/30 overflow-hidden min-h-[120px]"
                style={style}
              >
                {sponsor.tier === 'premium' && (
                  <span className="absolute top-1.5 right-1.5 z-10 rounded-full bg-accent px-1.5 py-0.5 text-[8px] font-bold text-accent-foreground">Premium</span>
                )}
                {sponsor.image_url ? (
                  logoStyle ? (
                    <div className="flex flex-col items-center gap-2 p-2">
                      <img
                        src={sponsor.image_url}
                        alt={sponsor.title}
                        className="h-12 w-auto max-w-[120px] object-contain"
                        loading="lazy"
                        onError={handleImageError}
                      />
                      <span className="text-xs font-semibold text-foreground text-center leading-tight">{sponsor.title}</span>
                      {sponsor.short_description && (
                        <span className="text-[10px] text-muted-foreground text-center line-clamp-1">{sponsor.short_description}</span>
                      )}
                    </div>
                  ) : (
                    <SponsorImage
                      src={sponsor.image_url}
                      alt={sponsor.title}
                      containerClassName="rounded-2xl"
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 p-4">
                    <span className="text-sm font-bold text-foreground">{sponsor.title}</span>
                    {sponsor.short_description && (
                      <span className="text-[10px] text-muted-foreground text-center">{sponsor.short_description}</span>
                    )}
                  </div>
                )}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SponsorsSection;
