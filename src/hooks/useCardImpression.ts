import { useEffect, useRef } from 'react';
import { trackCardView } from '@/lib/tracking';

/**
 * Hook that fires a card_view event once the element is visible on screen.
 */
export function useCardImpression(providerId: string, slug: string, source = 'home') {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || tracked.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !tracked.current) {
          tracked.current = true;
          trackCardView(providerId, slug, source);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [providerId, slug, source]);

  return ref;
}
