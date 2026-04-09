import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useSponsorsBySlot } from '@/hooks/useSponsors';
import SponsorPremiumCard from './SponsorPremiumCard';

interface Props {
  className?: string;
}

/** Premium sponsor cards for page tops — shows sponsors with position=featured */
const SponsorTopBanner = ({ className = '' }: Props) => {
  const { data: sponsors = [] } = useSponsorsBySlot('featured');
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
    <section className={`py-4 ${className}`}>
      <div className="container">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Patrocinadores</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sponsors.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4, ease: "easeOut" as const }}
            >
              <SponsorPremiumCard sponsor={s} compact={sponsors.length > 1} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SponsorTopBanner;
