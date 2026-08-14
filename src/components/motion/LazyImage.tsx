import { useRef, useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Proporção reservada (evita CLS) ex.: "16 / 9", "1 / 1". */
  aspect?: string;
  /** Classe aplicada ao wrapper (o placeholder/skeleton). */
  wrapperClassName?: string;
  /** Marque true apenas para a imagem LCP (acima da dobra). */
  priority?: boolean;
  /**
   * URL minúscula (ou data URI) exibida borrada enquanto a imagem final carrega.
   * Reduz o jank percebido: o usuário vê a composição da foto imediatamente.
   */
  blurSrc?: string;
  /** Cor sólida de fundo enquanto nada carregou (fallback do blur-up). */
  placeholderColor?: string;
}

/**
 * Imagem com lazy loading + skeleton shimmer + blur-up + fade na decodificação.
 *
 * - `loading="lazy"` e `decoding="async"` por padrão (priority desliga ambos);
 * - o wrapper reserva o espaço (aspect-ratio) → sem layout shift;
 * - `blurSrc` pinta um preview borrado que some em cross-fade quando a final chega;
 * - erro de carregamento não deixa buraco: mantém o placeholder neutro.
 */
const LazyImage = ({
  aspect,
  wrapperClassName,
  className,
  priority = false,
  blurSrc,
  placeholderColor,
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
        state === 'loading' && !blurSrc && 'skeleton-shimmer',
        wrapperClassName,
      )}
      style={{
        ...(aspect ? { aspectRatio: aspect } : {}),
        ...(placeholderColor ? { backgroundColor: placeholderColor } : {}),
      }}
    >
      {blurSrc && (
        <img
          src={blurSrc}
          alt=""
          aria-hidden="true"
          data-testid="lazy-image-blur"
          className={cn(
            'absolute inset-0 h-full w-full scale-105 object-cover blur-lg transition-opacity duration-[320ms]',
            state === 'loaded' ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}
      <img
        ref={imgRef}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        {...({ fetchpriority: priority ? 'high' : 'auto' } as Record<string, string>)}
        data-loaded={state === 'loaded' ? 'true' : 'false'}
        className={cn('motion-img relative h-full w-full object-cover', className)}
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

