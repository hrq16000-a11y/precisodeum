import { useEffect, useRef } from 'react';

/**
 * Sponsor Tracking Foundation (Fase 1.1) - viewability impression hook.
 *
 * Dispara `trackImpression(sponsor_id)` UMA VEZ por sessão por (sponsor_id + slot + pathname),
 * apenas quando o elemento ficar visível na tela (IntersectionObserver).
 *
 * Reaproveita o `trackImpression` central do `useSponsorsBySlot`, que já chama o RPC
 * `track_sponsor_metric`. Esse hook NÃO faz I/O direto — apenas controla quando disparar.
 */
const seen = new Set<string>();

interface Options {
  /** Threshold de visibilidade (default 0.5). */
  threshold?: number;
  /** Path atual (default window.location.pathname) — usado para deduplicação. */
  pathname?: string;
}

export function useSponsorImpression(
  sponsorId: string | undefined,
  slot: string,
  trackImpression: (id: string) => void,
  opts: Options = {},
) {
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!sponsorId) return;
    const el = ref.current;
    if (!el || fired.current) return;

    const path = opts.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
    const key = `${sponsorId}|${slot}|${path}`;
    if (seen.has(key)) {
      fired.current = true;
      return;
    }

    // Fallback: se IntersectionObserver não existir, dispara imediatamente
    if (typeof IntersectionObserver === 'undefined') {
      fired.current = true;
      seen.add(key);
      try { trackImpression(sponsorId); } catch { /* silent */ }
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fired.current) {
          fired.current = true;
          seen.add(key);
          try { trackImpression(sponsorId); } catch { /* silent */ }
          observer.disconnect();
        }
      },
      { threshold: opts.threshold ?? 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [sponsorId, slot, trackImpression, opts.threshold, opts.pathname]);

  return ref;
}

/** Util de testes — não usar em runtime. */
export function __resetSponsorImpressionDedupe() {
  seen.clear();
}
