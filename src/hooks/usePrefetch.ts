import { useCallback, useRef } from 'react';
import { prefetchImportWithRetry } from '@/lib/lazyWithRetry';

export function usePrefetchCategory() {
  const prefetched = useRef(new Set<string>());

  return useCallback((slug: string) => {
    if (!slug || prefetched.current.has(slug)) return;
    prefetched.current.add(slug);

    void prefetchImportWithRetry(`route-category:${slug}`, () => import('../pages/CategoryPage')).catch(() => {
      prefetched.current.delete(slug);
    });
  }, []);
}

export function usePrefetchProvider() {
  const prefetched = useRef(new Set<string>());

  return useCallback((slug: string) => {
    if (!slug || prefetched.current.has(slug)) return;
    prefetched.current.add(slug);

    void prefetchImportWithRetry(`route-provider:${slug}`, () => import('../pages/ProviderProfile')).catch(() => {
      prefetched.current.delete(slug);
    });
  }, []);
}

export function usePrefetchHandlers(prefetchFn: (key: string) => void, key: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPointerEnter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => prefetchFn(key), 80);
  }, [prefetchFn, key]);

  const onPointerLeave = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const onTouchStart = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    prefetchFn(key);
  }, [prefetchFn, key]);

  const onFocus = useCallback(() => {
    prefetchFn(key);
  }, [prefetchFn, key]);

  return { onPointerEnter, onPointerLeave, onTouchStart, onFocus };
}