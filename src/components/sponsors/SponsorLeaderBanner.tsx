import { lazy, Suspense } from 'react';
import { useSponsorsBySlot } from '@/hooks/useSponsors';

const LeaderSponsor = lazy(() => import('@/components/home/LeaderSponsor'));

/**
 * Self-contained wrapper that fetches hero-top sponsors and renders
 * the LeaderSponsor banner (8:1, full-width) — reusable on any page.
 */
const SponsorLeaderBanner = ({ className = '' }: { className?: string }) => {
  const { data: sponsors = [], trackImpression, trackClick } = useSponsorsBySlot('hero-top');

  if (sponsors.length === 0) return null;

  return (
    <Suspense fallback={null}>
      <div className={className}>
        <LeaderSponsor
          sponsors={sponsors as any}
          onClickTrack={trackClick}
          onImpressionTrack={trackImpression}
        />
      </div>
    </Suspense>
  );
};

export default SponsorLeaderBanner;
