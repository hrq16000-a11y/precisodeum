import { useEffect, useRef, memo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

const SponsorCard = memo(({ sponsor }: { sponsor: Sponsor }) => {
  const isPremium = sponsor.tier === 'premium';

  return (
    <a
      href={sponsor.link_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackMetric(sponsor.id, 'click')}
      className="group relative block overflow-hidden rounded-2xl shadow-card transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
    >
      {isPremium && (
        <span className="absolute top-2 right-2 z-10 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground shadow-sm">
          Premium
        </span>
      )}
      {sponsor.image_url ? (
        <img
          src={sponsor.image_url}
          alt={sponsor.title}
          className="w-full aspect-[2/1] object-cover"
          loading="lazy"
          onError={handleImageError}
        />
      ) : (
        <div className="flex items-center justify-center aspect-[2/1] bg-gradient-to-br from-primary/20 to-accent/20 p-4">
          <span className="text-sm font-bold text-foreground">{sponsor.title}</span>
        </div>
      )}
    </a>
  );
});

SponsorCard.displayName = 'SponsorCard';

const SponsorsSection = ({ sponsors }: Props) => {
  const visibleSponsors = sponsors.filter(
    s => s.position === 'banner' || s.position === 'card' || s.position === 'featured'
  );
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
  const sorted = [...visibleSponsors].sort(
    (a, b) => (tierOrder[a.tier || 'basic'] ?? 2) - (tierOrder[b.tier || 'basic'] ?? 2)
  );

  return (
    <section className="py-8">
      <div className="container">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">
            Parceiros & Patrocinadores
          </h2>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Publicidade
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map(sponsor => (
            <SponsorCard key={sponsor.id} sponsor={sponsor} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default memo(SponsorsSection);
