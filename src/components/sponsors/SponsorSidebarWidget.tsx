import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSponsorsBySlot } from '@/hooks/useSponsors';
import SponsorPremiumCard from './SponsorPremiumCard';

interface Props {
  className?: string;
}

/** Sticky sidebar widget for desktop - shows contextual sponsors */
const SponsorSidebarWidget = ({ className = '' }: Props) => {
  const { data: sponsors = [] } = useSponsorsBySlot('sidebar');
  const tracked = useRef(new Set<string>());

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
    <div className={`sticky top-24 space-y-3 ${className}`}>
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Patrocinadores</span>
      {sponsors.map((s) => (
        <SponsorPremiumCard key={s.id} sponsor={s} compact />
      ))}
    </div>
  );
};

export default SponsorSidebarWidget;
