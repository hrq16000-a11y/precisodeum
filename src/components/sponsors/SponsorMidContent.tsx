import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSponsorsBySlot } from '@/hooks/useSponsors';
import SponsorPremiumCard from './SponsorPremiumCard';

interface Props {
  className?: string;
}

/** Inline sponsor cards inserted between content lists — shows sponsors with position=mid-content */
const SponsorMidContent = ({ className = '' }: Props) => {
  const { data: sponsors = [] } = useSponsorsBySlot('mid-content');
  const tracked = useRef(new Set<string>());

  useEffect(() => {
    sponsors.forEach((s) => {
      if (!tracked.current.has(s.id)) {
        tracked.current.add(s.id);
        supabase.rpc('increment_sponsor_impression', { sponsor_id: s.id } as any);
      }
    });
  }, [sponsors]);

  if (sponsors.length === 0) return null;

  return (
    <div className={`py-3 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sponsors.map((s) => (
          <SponsorPremiumCard key={s.id} sponsor={s} compact />
        ))}
      </div>
    </div>
  );
};

export default SponsorMidContent;
