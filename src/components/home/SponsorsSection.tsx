import { useEffect, useMemo, memo } from 'react';
import { handleImageError } from '@/lib/imageResolver';
import { useSponsorsBySlot } from '@/hooks/useSponsors';
import { rankAndOptimise, recordImpression } from '@/lib/sponsorRanking';
import { getPositionConfig } from '@/config/sponsorPositions';

const SponsorCard = memo(({ sponsor, onClickTrack }: { sponsor: any; onClickTrack: (id: string) => void }) => {
  const isPremium = sponsor.tier === 'premium';
  const visualSrc = sponsor.logo_url || sponsor.image_url;

  if (!visualSrc) return null;

  return (
    <a
      href={sponsor.link_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onClickTrack(sponsor.id)}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      {isPremium && (
        <span className="absolute top-2 right-2 z-10 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground shadow-sm">
          Premium
        </span>
      )}

      <div className="flex aspect-[5/3] items-center justify-center bg-muted/10 p-3 sm:p-4">
        <img
          src={visualSrc}
          alt={sponsor.title}
          className="max-h-full max-w-full object-contain"
          loading="lazy"
          onError={handleImageError}
        />
      </div>

      <div className="border-t border-border/60 px-3 py-2">
        <p className="line-clamp-2 text-xs font-semibold text-foreground">
          {sponsor.company_name || sponsor.title}
        </p>
      </div>
    </a>
  );
});

SponsorCard.displayName = 'SponsorCard';

/** Self-contained: fetches position=card sponsors internally */
const SponsorsSection = () => {
  const { data: sponsors = [], trackImpression, trackClick } = useSponsorsBySlot('card');
  const config = getPositionConfig('card');

  const displayed = useMemo(
    () => rankAndOptimise(sponsors, { maxItems: config.maxItems }),
    [sponsors, config.maxItems],
  );

  useEffect(() => {
    displayed.forEach((s) => {
      trackImpression(s.id);
      recordImpression(s.id);
    });
  }, [displayed, trackImpression]);

  if (displayed.length === 0) return null;

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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {displayed.map((sponsor) => (
            <SponsorCard key={sponsor.id} sponsor={sponsor} onClickTrack={trackClick} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default memo(SponsorsSection);
