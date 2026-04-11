import { useEffect, useState, memo, useCallback, useRef, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
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
  /** Centralized click tracker from parent hook */
  onClickTrack?: (id: string) => void;
  /** Centralized impression tracker from parent hook */
  onImpressionTrack?: (id: string) => void;
}

const ROTATION_MS = 5000;

const LeaderSponsor = memo(forwardRef<HTMLElement, Props>(({ sponsors, onClickTrack, onImpressionTrack }, ref) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const validSponsors = sponsors.filter(s => s.image_url || s.logo_url);

  useEffect(() => {
    validSponsors.forEach(s => onImpressionTrack?.(s.id));
  }, [validSponsors, onImpressionTrack]);

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
    onClickTrack?.(id);
  }, [onClickTrack]);

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
      style={{ marginTop: 12, paddingLeft: 12, paddingRight: 12 }}
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
          className="block w-full cursor-pointer group"
        >
          {imageSrc && (
            <img
              src={imageSrc}
              alt={`${displayName}${current.short_description ? ' — ' + current.short_description : ''}`}
              className="w-full object-cover object-center"
              style={{ borderRadius: 10, aspectRatio: '8/1' }}
              loading="lazy"
              width={1600}
              height={200}
              onError={handleImageError}
            />
          )}
        </motion.a>
      </AnimatePresence>

      <div className="flex items-center justify-between px-1 py-1 mt-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[7px] sm:text-[8px] font-semibold tracking-widest uppercase text-muted-foreground/50 shrink-0">
            Patrocinado
          </span>
          <span className="text-[10px] sm:text-xs font-medium text-foreground/60 truncate">
            {displayName}
          </span>
          {current.short_description && (
            <span className="hidden sm:inline text-[10px] text-muted-foreground/50 truncate">
              — {current.short_description}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground/40 shrink-0">
          <ExternalLink className="h-2.5 w-2.5" />
        </span>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        className="absolute top-[16px] right-[16px] p-0.5 rounded-full bg-black/20 text-white/60 hover:text-white transition-colors z-10"
        aria-label="Fechar"
      >
        <X className="h-3 w-3" />
      </button>

      {validSponsors.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1 z-10">
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
}));

LeaderSponsor.displayName = 'LeaderSponsor';
export default LeaderSponsor;
