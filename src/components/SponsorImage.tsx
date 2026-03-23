import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { sponsorImage } from '@/lib/imageOptimizer';

type BannerShape = 'horizontal' | 'square' | 'vertical' | 'leaderboard';

interface SponsorImageProps {
  src: string;
  alt: string;
  /** Optional aspect ratio hint for desktop — ignored on mobile */
  forceAspectRatio?: string;
  className?: string;
  containerClassName?: string;
  /** Callback with detected dimensions */
  onDimensionsDetected?: (width: number, height: number, shape: BannerShape) => void;
}

function classifyRatio(w: number, h: number): BannerShape {
  const ratio = w / h;
  if (ratio >= 6) return 'leaderboard';
  if (ratio >= 1.8) return 'horizontal';
  if (ratio <= 0.85) return 'vertical';
  return 'square';
}

const shapeDefaults: Record<BannerShape, { aspectRatio: string; maxHeight: string }> = {
  leaderboard: { aspectRatio: '728/90', maxHeight: '120px' },
  horizontal: { aspectRatio: '16/5', maxHeight: '280px' },
  square: { aspectRatio: '1/1', maxHeight: '400px' },
  vertical: { aspectRatio: '3/4', maxHeight: '480px' },
};

const shapeAspectRatio: Record<BannerShape, string> = {
  leaderboard: '728/90',
  horizontal: '16/5',
  square: '1/1',
  vertical: '3/4',
};

const shapeLabelPt: Record<BannerShape, string> = {
  leaderboard: 'Leaderboard (horizontal longo)',
  horizontal: 'Horizontal',
  square: 'Quadrado',
  vertical: 'Vertical',
};

const SponsorImage = ({
  src,
  alt,
  forceAspectRatio,
  className = '',
  containerClassName = '',
  onDimensionsDetected,
}: SponsorImageProps) => {
  const optimizedSrc = sponsorImage(src);
  const [shape, setShape] = useState<BannerShape>('horizontal');
  const [loaded, setLoaded] = useState(false);
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);

  const onLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const detected = classifyRatio(w, h);
    setShape(detected);
    setNaturalDims({ w, h });
    setLoaded(true);
    onDimensionsDetected?.(w, h, detected);
  }, []);

  const defaults = shapeDefaults[shape];

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted/20 w-full',
        containerClassName
      )}
      style={{
        // On all screens: use aspect-ratio from detected shape or forced ratio
        // but cap max-height so vertical images don't dominate
        aspectRatio: forceAspectRatio || defaults.aspectRatio,
        maxHeight: forceAspectRatio ? undefined : defaults.maxHeight,
      }}
    >
      {/* Blurred background fill */}
      {loaded && (
        <div
          className="absolute inset-0 scale-[1.3]"
          style={{
            backgroundImage: `url(${optimizedSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(24px)',
            opacity: 0.5,
          }}
          aria-hidden="true"
        />
      )}
      {/* Sharp foreground image — always fully visible */}
      <img
        src={optimizedSrc}
        alt={alt}
        onLoad={onLoad}
        loading="lazy"
        className={cn(
          'relative z-10 h-full w-full object-contain object-center transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
          className
        )}
      />
      {/* Skeleton placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 z-10 animate-pulse bg-muted/30" />
      )}
    </div>
  );
};

export { SponsorImage, classifyRatio, shapeAspectRatio, shapeDefaults, shapeLabelPt };
export type { BannerShape };
export default SponsorImage;
