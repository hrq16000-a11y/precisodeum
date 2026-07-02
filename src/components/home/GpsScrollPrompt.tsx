import { useEffect, useRef, useState } from 'react';
import { Navigation, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGeoCity } from '@/hooks/useGeoCity';

const DISMISS_KEY = 'gps_scroll_prompt_dismissed_v1';

/**
 * Friendly GPS request banner that appears AFTER the user scrolls past the
 * categories grid on the home page. Shown only when:
 *  - the user has not already granted GPS,
 *  - they have not previously dismissed the prompt,
 *  - they have visibly engaged with the page (scrolled past categories).
 *
 * Mounted as a sentinel + sticky banner pair so it does not introduce CLS.
 */
const GpsScrollPrompt = () => {
  const { latitude, longitude, requestPreciseLocation } = useGeoCity();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasGps = latitude != null && longitude != null;

  // Read dismiss state once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (hasGps || dismissed) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasGps, dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  const handleAllow = async () => {
    try {
      await requestPreciseLocation();
    } finally {
      setVisible(false);
    }
  };

  // Sentinel always rendered (zero visual footprint) so we can detect scroll
  // without relying on global scroll listeners.
  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      {visible && !hasGps && !dismissed && (
        <div
          style={{ minHeight: 132 }}
          className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-lg backdrop-blur md:bottom-6 animate-in fade-in duration-200"
          role="dialog"
          aria-label="Solicitar localização"
        >
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Navigation className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">
                Quer ver profissionais perto de você?
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Ative o GPS para ordenarmos os resultados pela distância real.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="gap-1.5" onClick={handleAllow}>
                  <Navigation className="h-3.5 w-3.5" />
                  Ativar GPS
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  Agora não
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GpsScrollPrompt;
