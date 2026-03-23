import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { sponsorImage } from '@/lib/imageOptimizer';

type BannerShape = 'horizontal' | 'square' | 'vertical' | 'leaderboard';

interface SponsorImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  onDimensionsDetected?: (width: number, height: number, shape: BannerShape) => void;
}

function classifyRatio(w: number, h: number): BannerShape {
  const ratio = w / h;
  if (ratio >= 6) return 'leaderboard';
  if (ratio >= 1.8) return 'horizontal';
  if (ratio <= 0.85) return 'vertical';
  return 'square';
}

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

/**
 * Displays a sponsor image at its FULL natural proportions — NEVER cropped.
 * The image drives the container height via width:100% + height:auto.
 */
const SponsorImage = ({
  src,
  alt,
  className = '',
  containerClassName = '',
  onDimensionsDetected,
}: SponsorImageProps) => {
  const optimizedSrc = sponsorImage(src);
  const [loaded, setLoaded] = useState(false);
  const [shape, setShape] = useState<BannerShape>('horizontal');
  const [aspectRatio, setAspectRatio] = useState(shapeAspectRatio.horizontal);

  const onLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const detectedShape = classifyRatio(w, h);
    setShape(detectedShape);
    setAspectRatio(`${w}/${h}`);
    setLoaded(true);
    onDimensionsDetected?.(w, h, detectedShape);
  }, [onDimensionsDetected]);

  return (
    <div
      className={cn(
        'relative w-full',
        containerClassName
      )}
      data-shape={shape}
    >
      <div
        className={cn('relative w-full', `sponsor-shape-${shape}`)}
        style={{ aspectRatio }}
      >
        <img
          src={optimizedSrc}
          alt={alt}
          onLoad={onLoad}
          loading="lazy"
          className={cn(
            'absolute inset-0 block h-full w-full rounded-2xl object-contain object-center transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          style={{ maxWidth: '100%', height: '100%' }}
        />
        {!loaded && (
          <div className="h-full w-full animate-pulse rounded-2xl bg-muted/30" />
        )}
      </div>
    </div>
  );
};

export { SponsorImage, classifyRatio, shapeAspectRatio, shapeLabelPt };
export type { BannerShape };
export default SponsorImage;
