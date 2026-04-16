import { useState, useRef, useEffect, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Optional low-res placeholder or CSS background while loading */
  placeholderClass?: string;
  /** Base64 blur data URL (LQIP) */
  blurDataUrl?: string;
}

const LazyImage = ({ className, placeholderClass, blurDataUrl, onLoad, style, ...props }: LazyImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  const blurStyle: React.CSSProperties | undefined = blurDataUrl && !loaded
    ? {
        ...style,
        backgroundImage: `url(${blurDataUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : style;

  return (
    <img
      ref={imgRef}
      loading="lazy"
      decoding="async"
      className={cn(
        'transition-all duration-700 ease-out',
        loaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-[1.02]',
        blurDataUrl && !loaded && 'opacity-100 blur-0',
        placeholderClass,
        className,
      )}
      style={blurStyle}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      {...props}
    />
  );
};

export default LazyImage;
