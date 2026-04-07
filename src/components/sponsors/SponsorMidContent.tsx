import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useSponsorsByType } from '@/hooks/useSponsors';
import SponsorPremiumCard from './SponsorPremiumCard';

interface Props {
  city?: string;
  category?: string;
  className?: string;
}

/** Inline sponsor cards inserted between content lists */
const SponsorMidContent = ({ city, category, className = '' }: Props) => {
  const { data: globalSponsors = [] } = useSponsorsByType('global');
  const { data: citySponsors = [] } = useSponsorsByType('city', city);
  const { data: catSponsors = [] } = useSponsorsByType('category', category);
  const tracked = useRef(new Set<string>());

  const sponsors = [
    ...globalSponsors.filter(s => s.plan_tier !== 'basic'),
    ...citySponsors,
    ...catSponsors,
  ].slice(0, 2);

  useEffect(() => {
    sponsors.forEach(s => {
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
