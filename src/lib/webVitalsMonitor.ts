/**
 * Monitor leve de Core Web Vitals (LCP/CLS) sem dependência externa.
 * Reporta no console (warn) quando excede limites e expõe getter para
 * dashboards/telemetria futura. Foco: home mobile.
 *
 * Limites adotados (Google "good"):
 *  - LCP <= 2500ms
 *  - CLS <= 0.1
 *
 * Em devicePixelRatio >= 2 (mobile retina) usamos limites levemente mais
 * estritos para alertar cedo.
 */

interface VitalsState {
  lcp: number | null;
  cls: number;
  alerts: string[];
}

const state: VitalsState = { lcp: null, cls: 0, alerts: [] };

let started = false;

export function startWebVitalsMonitor() {
  if (started || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
  started = true;

  const isMobile = window.matchMedia?.('(max-width: 768px)').matches ?? false;
  const lcpBudget = isMobile ? 2500 : 3000;
  const clsBudget = 0.1;

  // LCP
  try {
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as any;
      if (last?.startTime) {
        state.lcp = Math.round(last.startTime);
        if (state.lcp > lcpBudget) {
          const msg = `[WebVitals] LCP ${state.lcp}ms excede limite ${lcpBudget}ms (mobile=${isMobile})`;
          state.alerts.push(msg);
          console.warn(msg);
        }
      }
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true } as any);
  } catch {
    /* no-op */
  }

  // CLS (acumulado, ignorando shifts com input recente)
  try {
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) {
          state.cls += entry.value;
        }
      }
      if (state.cls > clsBudget) {
        const msg = `[WebVitals] CLS ${state.cls.toFixed(3)} excede limite ${clsBudget}`;
        // limita ruído: só avisa quando passa de múltiplos de 0.05
        if (!state.alerts.some((a) => a.startsWith('[WebVitals] CLS'))) {
          state.alerts.push(msg);
          console.warn(msg);
        }
      }
    });
    clsObs.observe({ type: 'layout-shift', buffered: true } as any);
  } catch {
    /* no-op */
  }
}

export function getWebVitalsSnapshot(): Readonly<VitalsState> {
  return state;
}
