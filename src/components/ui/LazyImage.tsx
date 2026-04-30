import { useState, useRef, useEffect, useMemo, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { getImageVariants } from '@/lib/imageVariants';

/**
 * LazyImage com efeito Blur-up (LQIP) usando variantes do Supabase.
 *
 * Como funciona:
 * 1. A `src` (URL canônica) é passada para `getImageVariants` que produz `thumb`
 *    (320w, qualidade baixa), `medium` (800w) e `original` em renderização
 *    on-the-fly do Storage.
 * 2. Renderizamos a `thumb` posicionada absolutamente atrás da imagem principal,
 *    com `filter: blur(...)` + leve zoom para esconder bordas do desfoque. Ela
 *    preenche o container imediatamente, dando "peso" visual instantâneo.
 * 3. A imagem principal usa `srcSet` (320w/800w/1600w) — o navegador escolhe
 *    o melhor tamanho para o viewport / DPI (Retina).
 * 4. No `onLoad` da imagem principal, fazemos cross-fade (opacity 0 → 1) em
 *    ~400ms e ocultamos o blur.
 *
 * Backward-compat:
 * - Mantém props legadas `placeholderClass` e `blurDataUrl` (se passado, vence
 *   sobre as variantes — útil para LQIP estático/inline).
 * - Não altera proporções: o componente é apenas um <img>; o pai define o
 *   tamanho/aspect-ratio via classes.
 *
 * Uso:
 * ```tsx
 * <div className="aspect-video relative overflow-hidden">
 *   <LazyImage
 *     src={photoUrl}
 *     alt="Foto do serviço"
 *     className="h-full w-full object-cover"
 *     sizes="(max-width: 640px) 100vw, 800px"
 *   />
 * </div>
 * ```
 */
interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Classe extra (ex: bg neutro) aplicada ao wrapper enquanto não carrega. */
  placeholderClass?: string;
  /**
   * Data URL inline (LQIP estático) — opcional. Quando presente, é usado em vez
   * da variante thumb gerada pelo Supabase (útil para imagens externas).
   */
  blurDataUrl?: string;
  /**
   * Desabilita a geração automática de variantes/blur-up. Útil para sprites,
   * SVGs e ícones onde o efeito não faz sentido.
   */
  disableBlurUp?: boolean;
  /**
   * Sobrescreve o `sizes` do `srcSet`. Default: `(max-width: 640px) 320px, 800px`.
   */
  sizes?: string;
}

const LazyImage = ({
  className,
  placeholderClass,
  blurDataUrl,
  disableBlurUp,
  onLoad,
  onError,
  style,
  src,
  sizes,
  loading = 'lazy',
  decoding = 'async',
  ...props
}: LazyImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reseta o estado ao trocar de imagem.
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [src]);

  // Marca como carregada se já estava em cache ao montar.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  // Variantes geradas a partir da URL original. Memoiza para evitar trabalho.
  const variants = useMemo(() => {
    if (!src || disableBlurUp) return null;
    const v = getImageVariants(typeof src === 'string' ? src : '');
    // Se srcSet vazio (URL externa) também não vale a pena montar o blur stack.
    if (!v.srcSet) return null;
    return v;
  }, [src, disableBlurUp]);

  // Quando temos blurDataUrl explícito, usamos ele como background do <img> principal
  // (legacy path — um único <img>, sem stack).
  const legacyBlurStyle: React.CSSProperties | undefined =
    blurDataUrl && !loaded
      ? {
          ...style,
          backgroundImage: `url(${blurDataUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : style;

  // Caminho 1 — sem variantes ou blur-up desabilitado: comportamento legado.
  if (!variants) {
    return (
      <img
        ref={imgRef}
        src={typeof src === 'string' ? src : undefined}
        loading={loading}
        decoding={decoding}
        sizes={sizes}
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

  // Caminho 2 — blur-up com variantes do Supabase.
  // Estrutura:
  //   <span class="relative ...">
  //     <img thumb blur />      ← absolute, fade-out quando loaded
  //     <img main srcSet />      ← absolute, fade-in quando loaded
  //   </span>
  //
  // Usamos <span> para não introduzir block-level surpresa em layouts inline,
  // e position:absolute para que ambos ocupem 100% do container do consumidor.
  // O consumidor deve garantir `position: relative` + dimensões no wrapper
  // (ex: aspect-ratio). Como atalho, herdamos a `className` no <span> para que
  // utilities como `h-full w-full object-cover` continuem se aplicando ao
  // <img> principal — mantendo compat com call-sites existentes.
  const defaultSizes = sizes ?? '(max-width: 640px) 320px, 800px';

  return (
    <span
      className={cn(
        'relative block overflow-hidden',
        placeholderClass,
      )}
      // Preserva o style externo no wrapper (ex: aspect-ratio inline).
      style={style}
      aria-hidden={false}
    >
      {/* Thumb desfocada — só renderiza enquanto a principal não carrega/erra. */}
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
            // leve zoom para esconder bordas do blur
            'scale-[1.06]',
          )}
          style={{
            filter: 'blur(14px)',
            // Garante render rápido sem bloquear a thread principal.
            willChange: 'opacity',
          }}
          // Se a thumb falhar, simplesmente some — não é crítica.
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
        sizes={defaultSizes}
        loading={loading}
        decoding={decoding}
        className={cn(
          'h-full w-full',
          'transition-opacity duration-[400ms] ease-out',
          loaded ? 'opacity-100' : 'opacity-0',
          className,
        )}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setErrored(true);
          // Fallback: usa a URL original como src direto.
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
