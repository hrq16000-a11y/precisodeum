import { useEffect, useMemo } from 'react';
import { useSponsorsBySlot } from '@/hooks/useSponsors';
import { rankAndOptimise, recordImpression } from '@/lib/sponsorRanking';
import { getPositionConfig } from '@/config/sponsorPositions';
import SponsorPremiumCard from './SponsorPremiumCard';

interface Props {
  className?: string;
}

/** Inline sponsor cards inserted between content lists — shows sponsors with position=mid-content */
const SponsorMidContent = ({ className = '' }: Props) => {
  const { data: rawSponsors = [], trackImpression, trackClick } = useSponsorsBySlot('mid-content');
  const config = getPositionConfig('mid-content');
  const sponsors = useMemo(
    () => rankAndOptimise(rawSponsors, { maxItems: config.maxItems }),
    [rawSponsors, config.maxItems],
  );

  useEffect(() => {
    sponsors.forEach((s) => {
      trackImpression(s.id);
      recordImpression(s.id);
    });
  }, [sponsors, trackImpression]);

  if (sponsors.length === 0) return null;

  return (
    <div className={`py-3 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sponsors.map((s) => (
          <SponsorPremiumCard key={s.id} sponsor={s} compact onClickTrack={trackClick} />
        ))}
      </div>
    </div>
  );
};

export default SponsorMidContent;
