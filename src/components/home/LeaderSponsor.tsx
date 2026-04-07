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
      className="relative w-full bg-card"
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
          className="block w-full max-h-[90px] overflow-hidden cursor-pointer"
        >
          {imageSrc && (
            <img
              src={imageSrc}
              alt={displayName}
              className="w-full h-auto max-h-[90px] object-cover object-center"
              loading="lazy"
              onError={handleImageError}
            />
          )}
        </motion.a>
      </AnimatePresence>

      {/* Dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        className="absolute top-1 right-2 p-1 rounded-full bg-black/30 text-white/70 hover:text-white transition-colors z-10"
        aria-label="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Rotation dots */}
      {validSponsors.length > 1 && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {validSponsors.map((_, i) => (
            <span
              key={i}
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                i === currentIdx % validSponsors.length
                  ? 'w-5 bg-white/80'
                  : 'w-1.5 bg-white/40'
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
