import { useState, useRef, useEffect, useMemo, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { getImageVariants } from '@/lib/imageVariants';
import { logImageLoad } from '@/lib/lcpTelemetry';

/**
 * LazyImage com efeito Blur-up (LQIP) usando variantes do Supabase.
 *
 * Como funciona:
 * 1. A `src` (URL canônica) é passada para `getImageVariants` que produz
 *    `thumb` (320w q70), `medium` (800w q78), `original` e `srcSet`.
 * 2. A `thumb` é renderizada absolute atrás da imagem principal com
 *    `filter: blur(...)` + leve zoom.
 * 3. A imagem principal usa `srcSet` (320/800/1600w) — navegador escolhe
 *    o melhor tamanho para o viewport / DPI (Retina).
 * 4. No `onLoad` da principal, fazemos cross-fade ~400ms.
 *
 * Recursos extra:
 * - `priority`/`eager`: aplica `loading="eager"` + `fetchPriority="high"` e
 *   evita esperar a thumb (acelera LCP em above-the-fold).
 * - `sizesPreset`: presets nomeados ("card", "card-wide", "gallery-thumb",
 *   "hero", "avatar") evitam repetir strings de `sizes`.
 * - Telemetria opcional via `surface` (loga thumb e medium load times).
 *
 * Backward-compat:
 * - Mantém `placeholderClass`, `blurDataUrl`, `disableBlurUp` e a API base
 *   de `<img>`.
 * - URLs externas (não-Supabase) ou `disableBlurUp` → caminho legado (single
 *   `<img>`, sem stack).
 */

export type SizesPreset =
  | 'card' // ~280-320px (default)
  | 'card-wide' // 16:9 hero de card até 800px
  | 'gallery-thumb' // grid 3-4 col, ~200-260px
  | 'hero' // imagem de topo, full width
  | 'avatar'; // 48-96px

const SIZES_PRESETS: Record<SizesPreset, string> = {
  card: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px',
  'card-wide': '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px',
  'gallery-thumb': '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px',
  hero: '(max-width: 640px) 100vw, (max-width: 1280px) 100vw, 1280px',
  avatar: '(max-width: 640px) 48px, 96px',
};

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Classe extra aplicada ao wrapper enquanto não carrega (ex: bg neutro). */
  placeholderClass?: string;
  /**
   * Data URL inline (LQIP estático). Quando presente, é usado em vez da
   * variante thumb gerada pelo Supabase (útil para imagens externas).
   */
  blurDataUrl?: string;
  /** Desabilita variantes/blur-up (sprites, ícones). */
  disableBlurUp?: boolean;
  /**
   * Imagem prioritária (above-the-fold / LCP candidate). Aplica
   * `loading="eager"` + `fetchPriority="high"` e injeta `<link rel="preload">`
   * no <head> para o `medium` quando possível.
   */
  priority?: boolean;
  /**
   * Sobrescreve o `sizes` manualmente. Se omitido, usa `sizesPreset`.
   */
  sizes?: string;
  /**
   * Preset nomeado para `sizes`. Default: 'card'.
   */
  sizesPreset?: SizesPreset;
  /** Identificador do call-site para telemetria (ex: "company-card"). */
  surface?: string;
}

let preloadedUrls: Set<string> | null = null;
function preloadImage(url: string) {
  if (typeof document === 'undefined') return;
  if (!preloadedUrls) preloadedUrls = new Set();
  if (preloadedUrls.has(url)) return;
  preloadedUrls.add(url);
  try {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    // imagesrcset não é amplamente suportado em <link> dinâmico; manter simples.
    document.head.appendChild(link);
  } catch {
    // noop
  }
}

const LazyImage = ({
  className,
  placeholderClass,
  blurDataUrl,
  disableBlurUp,
  priority,
  onLoad,
  onError,
  style,
  src,
  sizes,
  sizesPreset = 'card',
  surface,
  loading,
  decoding = 'async',
  fetchPriority,
  ...props
}: LazyImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const startedAtRef = useRef<number>(0);
  const thumbStartedAtRef = useRef<number>(0);

  // Reseta estado ao trocar de imagem.
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
    startedAtRef.current =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    thumbStartedAtRef.current = startedAtRef.current;
  }, [src]);

  // Marca como carregada se já estava em cache ao montar.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  // Variantes geradas a partir da URL original.
  const variants = useMemo(() => {
    if (!src || disableBlurUp) return null;
    const v = getImageVariants(typeof src === 'string' ? src : '');
    if (!v.srcSet) return null;
    return v;
  }, [src, disableBlurUp]);

  // Preload do medium quando priority + variantes disponíveis.
  useEffect(() => {
    if (priority && variants?.medium) {
      preloadImage(variants.medium);
    }
  }, [priority, variants?.medium]);

  const resolvedSizes = sizes ?? SIZES_PRESETS[sizesPreset];
  const resolvedLoading: 'eager' | 'lazy' =
    loading ?? (priority ? 'eager' : 'lazy');
  const resolvedFetchPriority =
    (fetchPriority as 'high' | 'low' | 'auto' | undefined) ??
    (priority ? 'high' : undefined);

  // Estilo legado: blurDataUrl como background do <img> único.
  const legacyBlurStyle: React.CSSProperties | undefined =
    blurDataUrl && !loaded
      ? {
          ...style,
          backgroundImage: `url(${blurDataUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : style;

  // ====================================================================
  // Caminho 1 — sem variantes ou blur-up desabilitado: comportamento legado.
  // ====================================================================
  if (!variants) {
    return (
      <img
        ref={imgRef}
        src={typeof src === 'string' ? src : undefined}
        loading={resolvedLoading}
        decoding={decoding}
        sizes={resolvedSizes}
        fetchPriority={resolvedFetchPriority}
        className={cn(
          'transition-all duration-700 ease-out',
          loaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-[1.02]',
          blurDataUrl && !loaded && 'opacity-100 blur-0',
          placeholderClass,
          className,
        )}
        style={legacyBlurStyle}
        onLoad={(e) => {
          setLoaded(true);
          if (surface) {
            const dur =
              (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
              startedAtRef.current;
            logImageLoad({
              variant: 'unknown',
              url: typeof src === 'string' ? src : null,
              durationMs: dur,
              mode: disableBlurUp ? 'no-variants' : 'legacy',
              surface,
              renderedWidth: e.currentTarget.clientWidth || null,
            });
          }
          onLoad?.(e);
        }}
        onError={(e) => {
          setErrored(true);
          onError?.(e);
        }}
        {...props}
      />
    );
  }

  // ====================================================================
  // Caminho 2 — blur-up com variantes do Supabase.
  // ====================================================================
  return (
    <span
      className={cn('relative block overflow-hidden', placeholderClass)}
      style={style}
    >
      {/* Thumb desfocada — só enquanto a principal não carrega/erra. */}
      {!loaded && !errored && (
        <img
          src={blurDataUrl || variants.thumb}
          alt=""
          aria-hidden="true"
          decoding="async"
          loading="eager"
          className={cn(
            'absolute inset-0 h-full w-full object-cover',
            'transition-opacity duration-[400ms] ease-out',
            'scale-[1.06]',
          )}
          style={{
            filter: 'blur(14px)',
            willChange: 'opacity',
          }}
          onLoad={() => {
            if (surface) {
              const dur =
                (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
                thumbStartedAtRef.current;
              logImageLoad({
                variant: 'thumb',
                url: variants.thumb,
                durationMs: dur,
                mode: 'blur-up',
                surface,
              });
            }
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = '0';
          }}
        />
      )}

      {/* Imagem principal (medium/original via srcSet). */}
      <img
        ref={imgRef}
        src={variants.medium}
        srcSet={variants.srcSet}
        sizes={resolvedSizes}
        loading={resolvedLoading}
        decoding={decoding}
        fetchPriority={resolvedFetchPriority}
        className={cn(
          'h-full w-full',
          'transition-opacity duration-[400ms] ease-out',
          loaded ? 'opacity-100' : 'opacity-0',
          className,
        )}
        onLoad={(e) => {
          setLoaded(true);
          if (surface) {
            const dur =
              (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
              startedAtRef.current;
            logImageLoad({
              variant: 'medium',
              url: variants.medium,
              durationMs: dur,
              mode: 'blur-up',
              surface,
              renderedWidth: e.currentTarget.clientWidth || null,
            });
          }
          onLoad?.(e);
        }}
        onError={(e) => {
          setErrored(true);
          (e.currentTarget as HTMLImageElement).srcset = '';
          (e.currentTarget as HTMLImageElement).src = variants.original;
          onError?.(e);
        }}
        {...props}
      />
    </span>
  );
};

export default LazyImage;
