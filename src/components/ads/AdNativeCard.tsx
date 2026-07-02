import { useSponsorsBySlot } from '@/hooks/useSponsors';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import SponsorImage from '@/components/SponsorImage';
import { rankAndOptimise, recordImpression } from '@/lib/sponsorRanking';
import { getPositionConfig } from '@/config/sponsorPositions';
import { sponsorInternalHref } from '@/lib/sponsorLink';

interface AdNativeCardProps {
  sponsorIndex?: number;
  className?: string;
}

const AdNativeCard = ({ sponsorIndex = 0, className = '' }: AdNativeCardProps) => {
  const { data: rawSponsors = [], trackImpression, trackClick } = useSponsorsBySlot('native');
  const config = getPositionConfig('native');
  const sponsors = useMemo(
    () => rankAndOptimise(rawSponsors, { maxItems: config.maxItems }),
    [rawSponsors, config.maxItems],
  );

  const sponsor = sponsors[sponsorIndex % (sponsors.length || 1)];
  const visualSrc = sponsor?.logo_url || sponsor?.image_url;

  useEffect(() => {
    if (sponsor) {
      trackImpression(sponsor.id);
      recordImpression(sponsor.id);
    }
  }, [sponsor, trackImpression]);

  if (!sponsor) return null;

  const internalHref = sponsorInternalHref(sponsor.slug);

  return (
    <a
      href={sponsor.link_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackClick(sponsor.id)}
      className={`group min-w-0 overflow-hidden rounded-xl border border-accent/20 bg-accent/5 p-4 shadow-card transition-all hover:shadow-lg hover:border-accent/40 ${className}`}
    >
      <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
        <Megaphone className="h-3 w-3" /> Patrocinado
      </span>
      {visualSrc && (
        internalHref ? (
          <Link
            to={internalHref}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Ver página de ${sponsor.title}`}
            className="block"
          >
            <SponsorImage
              src={visualSrc}
              alt={sponsor.title}
              containerClassName="mb-3 rounded-lg"
            />
          </Link>
        ) : (
          <SponsorImage
            src={visualSrc}
            alt={sponsor.title}
            containerClassName="mb-3 rounded-lg"
          />
        )
      )}
      {internalHref ? (
        <Link
          to={internalHref}
          onClick={(e) => e.stopPropagation()}
          className="font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words hover:underline"
        >
          {sponsor.title}
        </Link>
      ) : (
        <h3 className="font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words">
          {sponsor.title}
        </h3>
      )}
    </a>
  );
};

export default AdNativeCard;
