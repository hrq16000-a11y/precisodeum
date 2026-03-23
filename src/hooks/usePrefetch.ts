import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePrefetchCategory() {
  const qc = useQueryClient();
  const prefetched = useRef(new Set<string>());

  return useCallback((slug: string) => {
    if (prefetched.current.has(slug)) return;
    prefetched.current.add(slug);
    qc.prefetchQuery({
      queryKey: ['category-providers', slug],
      queryFn: async () => {
        const { data: cat } = await supabase
          .from('categories')
          .select('id, name, slug, icon')
          .eq('slug', slug)
          .maybeSingle();
        if (!cat) return { category: null, providers: [] };
        return { category: cat, providers: [] };
      },
      staleTime: 1000 * 60 * 15,
    });
  }, [qc]);
}

export function usePrefetchProvider() {
  const prefetched = useRef(new Set<string>());
  return useCallback((slug: string) => {
    if (prefetched.current.has(slug)) return;
    prefetched.current.add(slug);
    import('../pages/ProviderProfile');
  }, []);
}

export function usePrefetchHandlers(prefetchFn: (key: string) => void, key: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPointerEnter = useCallback(() => {
    timerRef.current = setTimeout(() => prefetchFn(key), 80);
  }, [prefetchFn, key]);

  const onPointerLeave = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const onTouchStart = useCallback(() => { prefetchFn(key); }, [prefetchFn, key]);

  return { onPointerEnter, onPointerLeave, onTouchStart };
}
