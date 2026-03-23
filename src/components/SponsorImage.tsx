import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { sponsorImage } from '@/lib/imageOptimizer';

type BannerShape = 'horizontal' | 'square' | 'vertical' | 'leaderboard';

interface SponsorImageProps {
  src: string;
  alt: string;
  /** Force a specific aspect ratio string like "16/4" */
  forceAspectRatio?: string;
  className?: string;
  containerClassName?: string;
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

const SponsorImage = ({
  src,
  alt,
  forceAspectRatio,
  className = '',
  containerClassName = '',
}: SponsorImageProps) => {
  const optimizedSrc = sponsorImage(src);
  const [shape, setShape] = useState<BannerShape>('horizontal');
  const [loaded, setLoaded] = useState(false);
  const isMobile = useIsMobile();

  const onLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setShape(classifyRatio(img.naturalWidth, img.naturalHeight));
    setLoaded(true);
  }, []);

  const aspectRatio = forceAspectRatio || shapeAspectRatio[shape];

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted/20',
        containerClassName
      )}
      style={{
        aspectRatio: isMobile ? undefined : aspectRatio,
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
          'relative z-10 h-full w-full object-contain object-center',
          className
        )}
      />
    </div>
  );
};

export { SponsorImage, classifyRatio, shapeAspectRatio };
export type { BannerShape };
export default SponsorImage;
