import { forwardRef, useCallback, useRef } from 'react';
import { Link, type LinkProps } from '@/lib/router-compat';
import { prefetchRoute } from '@/lib/routePrefetchRegistry';

type PrefetchLinkProps = LinkProps & {
  /** Atraso (ms) antes de disparar prefetch em hover. Default 60ms (filtra movimentos rápidos). */
  prefetchDelay?: number;
  /** Desativa prefetch (mas mantém o Link funcionando). */
  noPrefetch?: boolean;
};

/**
 * Drop-in para `<Link>` do React Router que dispara `prefetchRoute(to)`
 * em hover/foco/touch — quando o usuário clicar, o chunk JS da página
 * já estará em cache do browser.
 *
 * Segurança:
 * - `prefetchRoute` é idempotente (cacheKey por rota).
 * - Falha de prefetch é silenciosa — nunca afeta a navegação real.
 * - Aceita `to` string ou object; objects extraem `.pathname`.
 */
const PrefetchLink = forwardRef<HTMLAnchorElement, PrefetchLinkProps>(function PrefetchLink(
  { to, prefetchDelay = 60, noPrefetch = false, onPointerEnter, onPointerLeave, onFocus, onTouchStart, ...rest },
  ref,
) {
  const timerRef = useRef<number | null>(null);

  const pathFromTo = useCallback((): string | null => {
    if (typeof to === 'string') return to;
    if (to && typeof to === 'object') {
      const p = (to as { pathname?: unknown }).pathname;
      if (typeof p === 'string') return p;
    }
    return null;
  }, [to]);

  const schedulePrefetch = useCallback(() => {
    if (noPrefetch) return;
    if (timerRef.current != null) return;
    const path = pathFromTo();
    if (!path) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      prefetchRoute(path);
    }, prefetchDelay);
  }, [noPrefetch, pathFromTo, prefetchDelay]);

  const cancelPrefetch = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return (
    <Link
      ref={ref}
      to={to}
      {...rest}
      onPointerEnter={(e) => {
        schedulePrefetch();
        onPointerEnter?.(e);
      }}
      onPointerLeave={(e) => {
        cancelPrefetch();
        onPointerLeave?.(e);
      }}
      onFocus={(e) => {
        schedulePrefetch();
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        // Em touch, dispara imediatamente — o gap entre touchstart e click é ~150ms.
        if (!noPrefetch) {
          const path = pathFromTo();
          if (path) prefetchRoute(path);
        }
        onTouchStart?.(e);
      }}
    />
  );
});

export default PrefetchLink;
