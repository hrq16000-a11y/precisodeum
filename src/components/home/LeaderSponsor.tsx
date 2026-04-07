import { useEffect, useRef, useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
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
      className="relative w-full bg-gradient-to-r from-amber-50 via-white to-amber-50 border-b border-amber-100/60 shadow-sm"
    >
      <AnimatePresence mode="wait">
        <motion.a
          key={current.id}
          href={current.link_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => handleClick(current.id)}
          data-sponsor={displayName}
          data-click="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative flex items-center justify-center w-full min-h-[50px] max-h-[70px] sm:min-h-[70px] sm:max-h-[110px] px-3 sm:px-6 py-1 cursor-pointer group transition-transform duration-200 hover:scale-[1.01]"
        >
          {/* Banner image — contain mode, no crop, no zoom */}
          {imageSrc && (
            <img
              src={imageSrc}
              alt={displayName}
              className="w-full h-full max-h-[50px] sm:max-h-[90px] object-contain object-center"
              loading="lazy"
              width={1920}
              height={512}
              onError={handleImageError}
            />
          )}

          {/* CTA hint on hover */}
          <span className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] sm:text-xs font-medium text-amber-700/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">Visitar</span>
          </span>
        </motion.a>
      </AnimatePresence>

      {/* Badge — top-left, discrete */}
      <span className="absolute top-1 left-2 sm:left-3 text-[7px] sm:text-[8px] font-semibold tracking-widest uppercase text-amber-600/50 pointer-events-none select-none">
        Patrocinado
      </span>

      {/* Dismiss button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        className="absolute top-1.5 right-2 p-0.5 rounded-full bg-amber-900/10 text-amber-700/40 hover:text-amber-900/70 transition-colors z-10"
        aria-label="Fechar"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Rotation dots */}
      {validSponsors.length > 1 && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {validSponsors.map((_, i) => (
            <span
              key={i}
              className={`block h-1 rounded-full transition-all duration-300 ${
                i === currentIdx % validSponsors.length
                  ? 'w-4 bg-amber-500/70'
                  : 'w-1.5 bg-amber-300/40'
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
