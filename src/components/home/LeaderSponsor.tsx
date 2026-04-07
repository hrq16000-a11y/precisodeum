import { useEffect, useRef, useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { handleImageError } from '@/lib/imageResolver';

interface LeaderSponsorData {
  id: string;
  title: string;
  company_name?: string;
  image_url: string | null;
  logo_url?: string | null;
  link_url: string | null;
  short_description?: string;
  tier?: string;
  display_order: number;
}

interface Props {
  sponsors: LeaderSponsorData[];
}

function trackMetric(sponsorId: string, eventType: 'impression' | 'click') {
  supabase.rpc('track_sponsor_metric', {
    _sponsor_id: sponsorId,
    _slot_slug: 'leader-sponsor',
    _event_type: eventType,
    _page_path: window.location.pathname,
  } as any).then(() => {});
}

const ROTATION_MS = 5000;

const LeaderSponsor = memo(({ sponsors }: Props) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const tracked = useRef(new Set<string>());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const validSponsors = sponsors.filter(s => s.image_url || s.logo_url);

  useEffect(() => {
    validSponsors.forEach(s => {
      if (!tracked.current.has(s.id)) {
        tracked.current.add(s.id);
        trackMetric(s.id, 'impression');
      }
    });
  }, [validSponsors]);

  useEffect(() => {
    if (validSponsors.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIdx(i => (i + 1) % validSponsors.length);
    }, ROTATION_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [validSponsors.length]);

  const handleClick = useCallback((id: string) => {
    trackMetric(id, 'click');
  }, []);

  if (validSponsors.length === 0 || dismissed) return null;

  const current = validSponsors[currentIdx % validSponsors.length];
  if (!current) return null;

  const displayName = current.company_name || current.title;
  const imageSrc = current.image_url || current.logo_url;

  return (
    <motion.section
      aria-label="Patrocinador"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative w-full"
    >
      <AnimatePresence mode="wait">
        <motion.a
          key={current.id}
          href={current.link_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => handleClick(current.id)}
          data-sponsor={displayName}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative block w-full h-[70px] sm:h-[90px] overflow-hidden cursor-pointer"
        >
          {/* Background image — full width */}
          {imageSrc && (
            <img
              src={imageSrc}
              alt={displayName}
              className="absolute inset-0 w-full h-full object-cover object-center"
              loading="lazy"
              width={1920}
              height={512}
              onError={handleImageError}
            />
          )}

          {/* Subtle gradient at bottom for text legibility */}
          <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />

          {/* Sponsor label — bottom-center, small & unobtrusive */}
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] font-medium tracking-widest uppercase text-white/60 whitespace-nowrap pointer-events-none">
            Patrocinado • {displayName}
          </span>
        </motion.a>
      </AnimatePresence>

      {/* Dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        className="absolute top-1.5 right-2 p-0.5 rounded-full bg-black/25 text-white/60 hover:text-white transition-colors z-10"
        aria-label="Fechar"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Rotation dots */}
      {validSponsors.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {validSponsors.map((_, i) => (
            <span
              key={i}
              className={`block h-1 rounded-full transition-all duration-300 ${
                i === currentIdx % validSponsors.length
                  ? 'w-4 bg-white/70'
                  : 'w-1.5 bg-white/30'
              }`}
            />
          ))}
        </div>
      )}
    </motion.section>
  );
});

LeaderSponsor.displayName = 'LeaderSponsor';
export default LeaderSponsor;
