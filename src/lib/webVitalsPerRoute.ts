/**
 * webVitalsPerRoute — Coleta LCP/INP/CLS/FCP/TTFB por rota e envia para
 * `web_vitals_log`. Sem dependências externas — usa PerformanceObserver nativo.
 *
 * Estratégia:
 *  - Coleta valores finais quando a página é "hidden" (mais confiável que load).
 *  - Reseta os observers ao trocar de rota (pushState/popstate) para que cada
 *    rota tenha sua própria leitura.
 *  - Best-effort: erros de envio são silenciados em produção.
 */

import { supabase } from '@/integrations/supabase/client';

type MetricName = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';

interface MetricSample {
  name: MetricName;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

const round = (v: number) => Math.round(v * 1000) / 1000;

const rate = (name: MetricName, value: number): MetricSample['rating'] => {
  // Thresholds Google: https://web.dev/vitals/
  switch (name) {
    case 'LCP': return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'INP': return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor';
    case 'CLS': return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'FCP': return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    case 'TTFB': return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
  }
};

interface RouteState {
  route: string;
  lcp: number | null;
  cls: number;
  fcp: number | null;
  ttfb: number | null;
  inpMax: number;
  observers: PerformanceObserver[];
  flushed: boolean;
}

let state: RouteState | null = null;
let installed = false;

const buildState = (route: string): RouteState => ({
  route,
  lcp: null,
  cls: 0,
  fcp: null,
  ttfb: null,
  inpMax: 0,
  observers: [],
  flushed: false,
});

const observe = (
  type: string,
  cb: (entries: PerformanceEntry[]) => void,
  extra: PerformanceObserverInit = {}
): PerformanceObserver | null => {
  try {
    const obs = new PerformanceObserver((list) => cb(list.getEntries()));
    obs.observe({ type, buffered: true, ...extra } as any);
    return obs;
  } catch {
    return null;
  }
};

const startObservers = (s: RouteState) => {
  // TTFB / FCP a partir do navigation timing (1 vez)
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) s.ttfb = round(nav.responseStart - nav.requestStart);
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcp) s.fcp = round(fcp.startTime);
  } catch { /* noop */ }

  const lcpObs = observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1] as any;
    if (last?.startTime) s.lcp = round(last.startTime);
  });
  if (lcpObs) s.observers.push(lcpObs);

  const clsObs = observe('layout-shift', (entries) => {
    for (const e of entries as any[]) {
      if (!e.hadRecentInput) s.cls += e.value || 0;
    }
  });
  if (clsObs) s.observers.push(clsObs);

  const inpObs = observe('event', (entries) => {
    for (const e of entries as any[]) {
      const latency = (e.processingStart && e.startTime)
        ? e.processingStart - e.startTime
        : (e.duration || 0);
      if (latency > s.inpMax) s.inpMax = latency;
    }
  }, { durationThreshold: 40 } as any);
  if (inpObs) s.observers.push(inpObs);

  const fcpObs = observe('paint', (entries) => {
    for (const e of entries) {
      if (e.name === 'first-contentful-paint' && s.fcp == null) {
        s.fcp = round(e.startTime);
      }
    }
  });
  if (fcpObs) s.observers.push(fcpObs);
};

const collectSamples = (s: RouteState): MetricSample[] => {
  const out: MetricSample[] = [];
  if (s.lcp != null) out.push({ name: 'LCP', value: round(s.lcp), rating: rate('LCP', s.lcp) });
  if (s.fcp != null) out.push({ name: 'FCP', value: round(s.fcp), rating: rate('FCP', s.fcp) });
  if (s.ttfb != null) out.push({ name: 'TTFB', value: round(s.ttfb), rating: rate('TTFB', s.ttfb) });
  if (s.inpMax > 0) out.push({ name: 'INP', value: round(s.inpMax), rating: rate('INP', s.inpMax) });
  out.push({ name: 'CLS', value: round(s.cls), rating: rate('CLS', s.cls) });
  return out;
};

const flush = async (s: RouteState) => {
  if (s.flushed) return;
  s.flushed = true;
  s.observers.forEach((o) => { try { o.disconnect(); } catch { /* noop */ } });

  const samples = collectSamples(s);
  if (!samples.length) return;

  try {
    const conn = (navigator as any).connection?.effectiveType ?? null;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

    const rows = samples.map((m) => ({
      route: s.route,
      metric: m.name,
      value: m.value,
      rating: m.rating,
      navigation_type: nav?.type || null,
      connection_type: conn,
      device_pixel_ratio: window.devicePixelRatio || 1,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      user_agent: navigator.userAgent.slice(0, 256),
    }));

    // user_id é capturado server-side via auth.uid() na RPC (sem spoofing).
    await (supabase.rpc as any)('log_web_vitals', {
      _samples: rows,
      _visitor_id: null,
    });
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[web-vitals] flush failed', err);
  }
};

const handleRouteChange = () => {
  if (state && !state.flushed) {
    void flush(state);
  }
  state = buildState(window.location.pathname);
  startObservers(state);
};

export const installWebVitalsPerRoute = () => {
  if (typeof window === 'undefined' || installed) return;
  installed = true;

  state = buildState(window.location.pathname);
  startObservers(state);

  // Patch pushState / replaceState para detectar SPA navigation
  const wrap = (key: 'pushState' | 'replaceState') => {
    const orig = history[key];
    history[key] = function (...args: any[]) {
      const ret = orig.apply(this, args as any);
      window.dispatchEvent(new Event('locationchange'));
      return ret;
    } as any;
  };
  wrap('pushState');
  wrap('replaceState');
  window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
  window.addEventListener('locationchange', handleRouteChange);

  // Flush quando a aba some (mais confiável que beforeunload)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state) {
      void flush(state);
    }
  });
};
