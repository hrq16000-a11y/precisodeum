import { useEffect, useMemo } from 'react';
import { useSponsorsBySlot } from '@/hooks/useSponsors';
import { rankAndOptimise, recordImpression } from '@/lib/sponsorRanking';
import { getPositionConfig } from '@/config/sponsorPositions';
import SponsorPremiumCard from './SponsorPremiumCard';

interface Props {
  className?: string;
}

/** Sticky sidebar widget for desktop - shows contextual sponsors */
const SponsorSidebarWidget = ({ className = '' }: Props) => {
  const { data: rawSponsors = [], trackImpression, trackClick } = useSponsorsBySlot('sidebar');
  const config = getPositionConfig('sidebar');
  const sponsors = useMemo(
    () => rankAndOptimise(rawSponsors, { maxItems: config.maxItems }),
    [rawSponsors, config.maxItems],
  );

  useEffect(() => {
    sponsors.forEach(s => {
      trackImpression(s.id);
      recordImpression(s.id);
    });
  }, [sponsors, trackImpression]);

  if (sponsors.length === 0) return null;

  return (
    <div className={`sticky top-24 space-y-3 ${className}`}>
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Patrocinadores</span>
      {sponsors.map((s) => (
        <SponsorPremiumCard key={s.id} sponsor={s} compact onClickTrack={trackClick} />
      ))}
    </div>
  );
};

export default SponsorSidebarWidget;
