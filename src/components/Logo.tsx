import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_LOGO_PNG_SRCSET, DEFAULT_LOGO_SRCSET, DEFAULT_LOGO_URL } from '@/lib/siteAssets';
import { handleBrandImageError } from '@/lib/imageResolver';
import { logHeaderFlicker } from '@/lib/headerFlickerDiagnostics';

interface LogoProps {
  variant?: 'default' | 'white' | 'dark';
  className?: string;
  linkTo?: string;
  priority?: boolean;
  sizes?: string;
}

/** Fallback embutido: nunca deixa buraco no header se a imagem falhar. */
const LogoFallbackSvg = ({ className = '' }: { className?: string }) => (
  <svg
    role="img"
    aria-label="Preciso de um Profissional"
    viewBox="0 0 111 40"
    className={`block h-14 min-h-14 max-h-14 w-auto shrink-0 sm:h-12 sm:min-h-12 sm:max-h-12 ${className}`}
    data-logo-fallback="true"
  >
    <rect width="111" height="40" rx="8" fill="hsl(var(--primary))" />
    <text
      x="55.5"
      y="25"
      textAnchor="middle"
      fontSize="14"
      fontWeight="700"
      fill="hsl(var(--primary-foreground))"
      fontFamily="system-ui, sans-serif"
    >
      Preciso
    </text>
  </svg>
);

const Logo = ({ variant = 'default', className = '', linkTo = '/', priority = false, sizes = '(max-width: 639px) 155px, 133px' }: LogoProps) => {
  const logo = DEFAULT_LOGO_URL;
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const startedAt = useRef<number>(Date.now());

  // Se a imagem já veio do cache, o onLoad pode não disparar em alguns browsers.
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setState('loaded');
  }, []);

  const filterClass = variant === 'white'
    ? 'brightness-0 invert'
    : variant === 'dark'
    ? 'brightness-0'
    : '';

  if (state === 'failed') {
    const svg = <LogoFallbackSvg className={className} />;
    return linkTo ? <Link to={linkTo}>{svg}</Link> : svg;
  }

  const img = (
    <span
      className={`relative block h-14 min-h-14 max-h-14 aspect-[111/40] w-auto shrink-0 sm:h-12 sm:min-h-12 sm:max-h-12 ${
        state === 'loading' ? 'skeleton-shimmer rounded-md bg-muted/60' : ''
      }`}
      data-logo-state={state}
    >
      <picture>
        <source type="image/webp" srcSet={DEFAULT_LOGO_SRCSET} sizes={sizes} />
        <img
          ref={imgRef}
          src={logo}
          srcSet={DEFAULT_LOGO_PNG_SRCSET}
          sizes={sizes}
          alt="Preciso de um Profissional"
          className={`block h-14 min-h-14 max-h-14 aspect-[111/40] w-auto max-w-full shrink-0 object-contain transition-opacity duration-200 sm:h-12 sm:min-h-12 sm:max-h-12 ${
            state === 'loaded' ? 'opacity-100' : 'opacity-0'
          } ${filterClass} ${className}`}
          width="710"
          height="209"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          // PR 7: fetchpriority é DOM attr nativo; React 18 não reconhece a versão
          // camelCase e emite warning. Passamos via spread em lowercase.
          {...({ fetchpriority: priority ? 'high' : 'auto' } as Record<string, string>)}
          onLoad={() => {
            const elapsed = Date.now() - startedAt.current;
            if (elapsed > 600) logHeaderFlicker('logo_load_delay', { elapsed_ms: elapsed });
            setState('loaded');
          }}
          onError={(e) => {
            handleBrandImageError(e, 'logo');
            const img = e.currentTarget;
            // Só cai para o SVG embutido se o próprio fallback também falhar.
            if (img.dataset.brandFallbackTried === '1') {
              setState('failed');
              return;
            }
            img.dataset.brandFallbackTried = '1';
          }}
        />
      </picture>
    </span>
  );

  if (!linkTo) return img;

  return <Link to={linkTo}>{img}</Link>;
};

export default Logo;
