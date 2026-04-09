import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSponsorsByPosition } from '@/components/SponsorAd';
import SponsorPremiumCard from './SponsorPremiumCard';

interface Props {
  className?: string;
}

/** Inline sponsor cards inserted between content lists — shows sponsors with position=mid-content */
const SponsorMidContent = ({ className = '' }: Props) => {
  const { data: sponsors = [] } = useSponsorsByPosition('mid-content');
  const tracked = useRef(new Set<string>());

  const visible = sponsors.filter(s => (s as any).image_url || (s as any).logo_url).slice(0, 2);

  useEffect(() => {
    visible.forEach((s: any) => {
      if (!tracked.current.has(s.id)) {
        tracked.current.add(s.id);
        supabase.rpc('increment_sponsor_impression', { sponsor_id: s.id } as any);
      }
    });
  }, [visible]);

  if (visible.length === 0) return null;

  return (
    <div className={`py-3 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.map((s: any) => (
          <SponsorPremiumCard key={s.id} sponsor={s} compact />
        ))}
      </div>
    </div>
  );
};

export default SponsorMidContent;
