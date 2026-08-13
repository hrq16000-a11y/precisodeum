import { useRef, useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Proporção reservada (evita CLS) ex.: "16 / 9", "1 / 1". */
  aspect?: string;
  /** Classe aplicada ao wrapper (o placeholder/skeleton). */
  wrapperClassName?: string;
  /** Marque true apenas para a imagem LCP (acima da dobra). */
  priority?: boolean;
}

/**
 * Imagem com lazy loading + skeleton shimmer + fade/blur-up na decodificação.
 *
 * - `loading="lazy"` e `decoding="async"` por padrão (priority desliga ambos);
 * - o wrapper reserva o espaço (aspect-ratio) → sem layout shift;
 * - erro de carregamento não deixa buraco: mantém o placeholder neutro.
 */
const LazyImage = ({
  aspect,
  wrapperClassName,
  className,
  priority = false,
  onLoad,
  onError,
  alt = '',
  ...props
}: LazyImageProps) => {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const imgRef = useRef<HTMLImageElement | null>(null);

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted',
        state === 'loading' && 'skeleton-shimmer',
        wrapperClassName,
      )}
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      <img
        ref={imgRef}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        data-loaded={state === 'loaded' ? 'true' : 'false'}
        className={cn('motion-img h-full w-full object-cover', className)}
        onLoad={(e) => {
          setState('loaded');
          onLoad?.(e);
        }}
        onError={(e) => {
          setState('error');
          onError?.(e);
        }}
        {...props}
      />
    </div>
  );
};

export default LazyImage;
export { LazyImage };
