import { useEffect } from 'react';
import { prefetchRoute } from '@/lib/routePrefetchRegistry';

/**
 * GlobalLinkPrefetcher — acelera navegação SPA de forma não-invasiva:
 *
 *  1. Delegação global de `pointerenter`/`focusin` em `<a href="/...">` internos:
 *     agenda `prefetchRoute()` com debounce curto (80ms). Filtra movimentos rápidos
 *     do mouse. `pointerleave` cancela o timer.
 *  2. Em touch, `touchstart` dispara imediatamente (gap ~150ms até `click`).
 *  3. `IntersectionObserver` prefeta os primeiros N links internos visíveis em
 *     idle time — cobre nav superior, cards de categoria/prestador etc. sem
 *     precisar migrar cada `<Link>` para `<PrefetchLink>`.
 *
 * Idempotente (o registry usa cacheKey). Falhas são silenciosas.
 */
const HOVER_DELAY_MS = 80;
const VIEWPORT_PREFETCH_CAP = 24;

const isInternalHref = (href: string | null | undefined): href is string => {
  if (!href) return false;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  return false;
};

const pathFromHref = (href: string): string => {
  try {
    return new URL(href, window.location.origin).pathname;
  } catch {
    return href;
  }
};

const GlobalLinkPrefetcher = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const timers = new WeakMap<Element, number>();

    const cancel = (el: Element) => {
      const t = timers.get(el);
      if (t != null) {
        clearTimeout(t);
        timers.delete(el);
      }
    };

    const schedule = (el: Element, path: string, immediate = false) => {
      cancel(el);
      if (immediate) {
        prefetchRoute(path);
        return;
      }
      const id = window.setTimeout(() => {
        timers.delete(el);
        prefetchRoute(path);
      }, HOVER_DELAY_MS);
      timers.set(el, id);
    };

    const findAnchor = (target: EventTarget | null): HTMLAnchorElement | null => {
      const el = target as Element | null;
      if (!el || !el.closest) return null;
      return el.closest('a[href]') as HTMLAnchorElement | null;
    };

    const onPointerEnter = (e: Event) => {
      const a = findAnchor(e.target);
      if (!a) return;
      const href = a.getAttribute('href');
      if (!isInternalHref(href)) return;
      schedule(a, pathFromHref(href));
    };

    const onPointerLeave = (e: Event) => {
      const a = findAnchor(e.target);
      if (a) cancel(a);
    };

    const onTouchStart = (e: Event) => {
      const a = findAnchor(e.target);
      if (!a) return;
      const href = a.getAttribute('href');
      if (!isInternalHref(href)) return;
      schedule(a, pathFromHref(href), true);
    };

    // Delegação via capture — pega todos os anchors sem depender de handler por elemento.
    document.addEventListener('pointerenter', onPointerEnter, true);
    document.addEventListener('pointerleave', onPointerLeave, true);
    document.addEventListener('focusin', onPointerEnter, true);
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });

    // Viewport prefetch em idle — best-effort, cap para não explodir rede.
    let observer: IntersectionObserver | null = null;
    let prefetchedCount = 0;
    const seen = new WeakSet<Element>();

    const startViewportPrefetch = () => {
      if (!('IntersectionObserver' in window)) return;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            if (prefetchedCount >= VIEWPORT_PREFETCH_CAP) {
              observer?.disconnect();
              return;
            }
            const a = entry.target as HTMLAnchorElement;
            if (seen.has(a)) continue;
            seen.add(a);
            const href = a.getAttribute('href');
            if (isInternalHref(href)) {
              prefetchRoute(pathFromHref(href));
              prefetchedCount++;
            }
            observer?.unobserve(a);
          }
        },
        { rootMargin: '200px' },
      );
      const anchors = document.querySelectorAll('a[href^="/"]:not([href^="//"])');
      anchors.forEach((a) => observer?.observe(a));
    };

    const rIC: any = (window as any).requestIdleCallback;
    const idleId = typeof rIC === 'function'
      ? rIC(startViewportPrefetch, { timeout: 2500 })
      : window.setTimeout(startViewportPrefetch, 1200);

    return () => {
      document.removeEventListener('pointerenter', onPointerEnter, true);
      document.removeEventListener('pointerleave', onPointerLeave, true);
      document.removeEventListener('focusin', onPointerEnter, true);
      document.removeEventListener('touchstart', onTouchStart, true);
      observer?.disconnect();
      const cIC: any = (window as any).cancelIdleCallback;
      if (typeof cIC === 'function') cIC(idleId);
      else clearTimeout(idleId as number);
    };
  }, []);

  return null;
};

export default GlobalLinkPrefetcher;
