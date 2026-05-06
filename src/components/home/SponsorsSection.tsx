import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import SponsorImage from '@/components/SponsorImage';

interface Sponsor {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  position: string;
}

interface Props {
  sponsors: Sponsor[];
}

/** Sponsors section — visual-first, no text labels, big images */
const SponsorsSection = ({ sponsors }: Props) => {
  const visibleSponsors = sponsors.filter(s => s.position === 'banner' || s.position === 'card' || s.position === 'featured');
  const tracked = useRef(new Set<string>());

  useEffect(() => {
    visibleSponsors.forEach(s => {
      if (!tracked.current.has(s.id)) {
        tracked.current.add(s.id);
        supabase.rpc('increment_sponsor_impression', { sponsor_id: s.id } as any).then(() => {});
      }
    });
  }, [visibleSponsors]);

  if (visibleSponsors.length === 0) return null;

  return (
    <section className="py-8">
      <div className="container">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleSponsors.map((sponsor) => (
            <a
              key={sponsor.id}
              href={sponsor.link_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => supabase.rpc('increment_sponsor_click', { sponsor_id: sponsor.id } as any)}
              className="group rounded-2xl shadow-card transition-all hover:shadow-lg hover:scale-[1.02]"
            >
              {sponsor.image_url ? (
                <SponsorImage
                  src={sponsor.image_url}
                  alt={sponsor.title}
                  containerClassName="rounded-2xl"
                />
              ) : (
                <div className="flex items-center justify-center bg-muted/20 p-6 min-h-[100px]">
                  <span className="text-sm font-bold text-muted-foreground">{sponsor.title}</span>
                </div>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SponsorsSection;
