import { useEffect, useRef, useState } from 'react';
import { Link } from '@/lib/router-compat';
import { DEFAULT_LOGO_PNG_SRCSET, DEFAULT_LOGO_SRCSET, DEFAULT_LOGO_URL } from '@/lib/siteAssets';
import { handleBrandImageError } from '@/lib/imageResolver';
import { logHeaderFlicker } from '@/lib/headerFlickerDiagnostics';

/**
 * Contextos de uso da logo. Todos compartilham o MESMO aspect-ratio (111/40),
 * mudando apenas a altura — assim ela nunca fica desproporcional nem "pequena
 * demais" em algum layout.
 */
export type LogoContext = 'header' | 'footer' | 'dashboard' | 'admin';

export const LOGO_ASPECT_CLASS = 'aspect-[111/40]';

/** Altura por contexto (mobile → desktop). Fonte única de verdade. */
export const LOGO_SIZE_CLASSES: Record<LogoContext, string> = {
  header: 'h-16 min-h-16 max-h-16 sm:h-14 sm:min-h-14 sm:max-h-14',
  dashboard: 'h-14 min-h-14 max-h-14 sm:h-12 sm:min-h-12 sm:max-h-12',
  admin: 'h-14 min-h-14 max-h-14 sm:h-12 sm:min-h-12 sm:max-h-12',
  footer: 'h-12 min-h-12 max-h-12 sm:h-14 sm:min-h-14 sm:max-h-14',
};

export const LOGO_SIZES_ATTR: Record<LogoContext, string> = {
  header: '(max-width: 639px) 190px, 165px',
  dashboard: '(max-width: 639px) 155px, 133px',
  admin: '(max-width: 639px) 155px, 133px',
  footer: '(max-width: 639px) 133px, 155px',
};

interface LogoProps {
  variant?: 'default' | 'white' | 'dark';
  className?: string;
  linkTo?: string;
  priority?: boolean;
  sizes?: string;
  /** Define tamanho/sizes padrão do contexto. Default: 'header'. */
  context?: LogoContext;
  /** Injeta <link rel="preload"> da logo (use apenas no Header). */
  preload?: boolean;
}

/** Fallback embutido: nunca deixa buraco no header se a imagem falhar. */
const LogoFallbackSvg = ({ className = '', sizeClass = '' }: { className?: string; sizeClass?: string }) => (
  <svg
    role="img"
    aria-label="Preciso de um Profissional"
    viewBox="0 0 111 40"
    className={`block w-auto shrink-0 ${sizeClass} ${className}`}
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

/** Dedupe global: o preload só é inserido uma vez por documento. */
let preloadInjected = false;
export function __resetLogoPreloadForTests() {
  preloadInjected = false;
}

function ensureLogoPreload() {
  if (preloadInjected || typeof document === 'undefined') return;
  if (document.querySelector('link[rel="preload"][data-logo-preload="true"]')) {
    preloadInjected = true;
    return;
  }
  const link = document.createElement('link');
  link.setAttribute('rel', 'preload');
  link.setAttribute('as', 'image');
  link.setAttribute('href', DEFAULT_LOGO_URL);
  link.setAttribute('imagesrcset', DEFAULT_LOGO_PNG_SRCSET);
  link.setAttribute('imagesizes', LOGO_SIZES_ATTR.header);
  link.setAttribute('fetchpriority', 'high');
  link.setAttribute('data-logo-preload', 'true');
  document.head.appendChild(link);
  preloadInjected = true;
}

const Logo = ({
  variant = 'default',
  className = '',
  linkTo = '/',
  priority = false,
  sizes,
  context = 'header',
  preload = false,
}: LogoProps) => {
  const logo = DEFAULT_LOGO_URL;
  const sizeClass = LOGO_SIZE_CLASSES[context];
  const sizesAttr = sizes || LOGO_SIZES_ATTR[context];
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const startedAt = useRef<number>(Date.now());

  // Se a imagem já veio do cache, o onLoad pode não disparar em alguns browsers.
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setState('loaded');
  }, []);

  useEffect(() => {
    if (preload) ensureLogoPreload();
  }, [preload]);

  const filterClass = variant === 'white'
    ? 'brightness-0 invert'
    : variant === 'dark'
    ? 'brightness-0'
    : '';

  if (state === 'failed') {
    const svg = <LogoFallbackSvg className={className} sizeClass={sizeClass} />;
    return linkTo ? <Link to={linkTo}>{svg}</Link> : svg;
  }

  const img = (
    <span
      className={`relative block w-auto shrink-0 ${sizeClass} ${LOGO_ASPECT_CLASS} ${
        state === 'loading' ? 'skeleton-shimmer rounded-md bg-muted/60' : ''
      }`}
      data-logo-state={state}
      data-logo-context={context}
    >
      <picture>
        <source type="image/webp" srcSet={DEFAULT_LOGO_SRCSET} sizes={sizesAttr} />
        <img
          ref={imgRef}
          src={logo}
          srcSet={DEFAULT_LOGO_PNG_SRCSET}
          sizes={sizesAttr}
          alt="Preciso de um Profissional"
          className={`block w-auto max-w-full shrink-0 object-contain transition-opacity duration-200 ${sizeClass} ${LOGO_ASPECT_CLASS} ${
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
