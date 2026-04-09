import { useEffect } from 'react';
import { useSponsorsBySlot } from '@/hooks/useSponsors';
import SponsorPremiumCard from './SponsorPremiumCard';

interface Props {
  className?: string;
}

/** Inline sponsor cards inserted between content lists — shows sponsors with position=mid-content */
const SponsorMidContent = ({ className = '' }: Props) => {
  const { data: sponsors = [], trackImpression, trackClick } = useSponsorsBySlot('mid-content');

  useEffect(() => {
    sponsors.forEach((s) => trackImpression(s.id));
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
