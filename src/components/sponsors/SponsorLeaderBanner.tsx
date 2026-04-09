import { lazy, Suspense } from 'react';
import { useSponsorsByPosition } from '@/components/SponsorAd';

const LeaderSponsor = lazy(() => import('@/components/home/LeaderSponsor'));

/**
 * Self-contained wrapper that fetches hero-top sponsors and renders
 * the LeaderSponsor banner (8:1, full-width) — reusable on any page.
 */
const SponsorLeaderBanner = ({ className = '' }: { className?: string }) => {
  const { data: sponsors = [] } = useSponsorsByPosition('hero-top');

  const valid = sponsors.filter(s => s.image_url || (s as any).logo_url);
  if (valid.length === 0) return null;

  return (
    <Suspense fallback={null}>
      <div className={className}>
        <LeaderSponsor sponsors={valid as any} />
      </div>
    </Suspense>
  );
};

export default SponsorLeaderBanner;
