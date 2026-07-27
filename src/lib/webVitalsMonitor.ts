/**
 * Monitor leve de Core Web Vitals (LCP/CLS/INP/FCP/TTFB) sem dependência externa.
 * Reporta no console (warn) quando excede limites e expõe getter para
 * dashboards/telemetria futura. Também registra snapshots de navegação
 * para comparação antes/depois de mudanças no sistema de prefetch.
 */

interface NavSample {
  path: string;
  startedAt: number;
  duration: number;
}

interface VitalsState {
  lcp: number | null;
  cls: number;
  inp: number | null;
  fcp: number | null;
  ttfb: number | null;
  alerts: string[];
  navigations: NavSample[];
}

const state: VitalsState = {
  lcp: null,
  cls: 0,
  inp: null,
  fcp: null,
  ttfb: null,
  alerts: [],
  navigations: [],
};

let started = false;
let navStart: { path: string; at: number } | null = null;

const nowTs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function markNavigationStart(path: string) {
  navStart = { path, at: nowTs() };
}

export function markNavigationEnd(path: string) {
  if (!navStart) return;
  const duration = Math.round(nowTs() - navStart.at);
  state.navigations.push({ path, startedAt: navStart.at, duration });
  if (state.navigations.length > 30) state.navigations.shift();
  navStart = null;
}

export function startWebVitalsMonitor() {
  if (started || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
  started = true;

  const isMobile = window.matchMedia?.('(max-width: 768px)').matches ?? false;
  const lcpBudget = isMobile ? 2500 : 3000;
  const clsBudget = 0.1;
  const inpBudget = 200;

  // Navigation Timing → TTFB
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) state.ttfb = Math.round(nav.responseStart);
  } catch { /* no-op */ }

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
  } catch { /* no-op */ }

  // FCP
  try {
    const fcpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          state.fcp = Math.round(entry.startTime);
        }
      }
    });
    fcpObs.observe({ type: 'paint', buffered: true } as any);
  } catch { /* no-op */ }

  // CLS
  try {
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) state.cls += entry.value;
      }
      if (state.cls > clsBudget && !state.alerts.some((a) => a.startsWith('[WebVitals] CLS'))) {
        const msg = `[WebVitals] CLS ${state.cls.toFixed(3)} excede limite ${clsBudget}`;
        state.alerts.push(msg);
        console.warn(msg);
      }
    });
    clsObs.observe({ type: 'layout-shift', buffered: true } as any);
  } catch { /* no-op */ }

  // INP (via event timing) — aproximação: pior duration entre interações.
  try {
    const inpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        const d = Math.round(entry.duration || 0);
        if (d > 0 && (state.inp == null || d > state.inp)) {
          state.inp = d;
          if (d > inpBudget && !state.alerts.some((a) => a.startsWith('[WebVitals] INP'))) {
            const msg = `[WebVitals] INP ${d}ms excede limite ${inpBudget}ms`;
            state.alerts.push(msg);
            console.warn(msg);
          }
        }
      }
    });
    inpObs.observe({ type: 'event', buffered: true, durationThreshold: 40 } as any);
  } catch { /* no-op */ }

  if (typeof window !== 'undefined') {
    (window as any).__webVitals = state;
  }
}

export function getWebVitalsSnapshot(): Readonly<VitalsState> {
  return state;
}
