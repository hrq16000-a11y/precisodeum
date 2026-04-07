import { useEffect, useRef, useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, BadgeCheck, X } from 'lucide-react';
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

  // Filter only sponsors with visual content
  const validSponsors = sponsors.filter(s => s.image_url || s.logo_url);

  // Track impressions
  useEffect(() => {
    validSponsors.forEach(s => {
      if (!tracked.current.has(s.id)) {
        tracked.current.add(s.id);
        trackMetric(s.id, 'impression');
      }
    });
  }, [validSponsors]);

  // Auto-rotate
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
  const logoSrc = current.logo_url || current.image_url;

  return (
    <motion.section
      aria-label="Patrocinador"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative w-full border-b border-border/40 bg-gradient-to-r from-card via-card to-muted/30"
    >
      <div className="container px-4">
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
            className="group flex items-center gap-3 sm:gap-4 py-2 sm:py-3 min-h-[50px] sm:min-h-[70px] max-h-[70px] sm:max-h-[110px] transition-transform duration-200 hover:scale-[1.005] cursor-pointer"
          >
            {/* Logo */}
            <div className="flex h-[36px] w-[36px] sm:h-[50px] sm:w-[50px] shrink-0 items-center justify-center rounded-lg bg-muted/40 p-1.5 sm:p-2 overflow-hidden">
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt={displayName}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  onError={handleImageError}
                />
              )}
            </div>

            {/* Text content */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs sm:text-sm font-bold text-foreground">
                {displayName}
              </p>
              {current.short_description && (
                <p className="truncate text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                  {current.short_description}
                </p>
              )}
            </div>
          </motion.a>
        </AnimatePresence>

        {/* Badge */}
        <div className="absolute top-1 right-12 sm:right-14 flex items-center gap-0.5 opacity-50">
          <BadgeCheck className="h-2.5 w-2.5 text-muted-foreground" />
          <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
            Patrocinado
          </span>
        </div>

        {/* Dismiss button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
          }}
          className="absolute top-1 right-3 sm:right-4 p-1 rounded-full text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="h-3 w-3" />
        </button>

        {/* Rotation dots */}
        {validSponsors.length > 1 && (
          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-1">
            {validSponsors.map((_, i) => (
              <span
                key={i}
                className={`block h-1 rounded-full transition-all duration-300 ${
                  i === currentIdx % validSponsors.length
                    ? 'w-4 bg-primary/60'
                    : 'w-1.5 bg-muted-foreground/20'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
});

LeaderSponsor.displayName = 'LeaderSponsor';
export default LeaderSponsor;
