import { supabase } from '@/integrations/supabase/client';

type Vitals = Record<string, number>;

const REPORT_DELAY_MS = 6500;
const SLOW_LCP_MS = 2500;
const SLOW_TTFB_MS = 800;
const SLOW_BACKEND_MS = 900;

const round = (value: number) => Math.round(value * 100) / 100;

const getNavigation = () => performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

const getLcp = () => new Promise<number | null>((resolve) => {
  if (!('PerformanceObserver' in window)) return resolve(null);
  let value: number | null = null;
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry | undefined;
      if (last) value = last.startTime;
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    window.setTimeout(() => {
      observer.disconnect();
      resolve(value == null ? null : round(value));
    }, 0);
  } catch {
    resolve(null);
  }
});

const getCls = () => new Promise<number>((resolve) => {
  if (!('PerformanceObserver' in window)) return resolve(0);
  let cls = 0;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) cls += entry.value || 0;
      }
    });
    observer.observe({ type: 'layout-shift', buffered: true });
    window.setTimeout(() => {
      observer.disconnect();
      resolve(round(cls));
    }, 0);
  } catch {
    resolve(0);
  }
});

const getInp = () => new Promise<number | null>((resolve) => {
  if (!('PerformanceObserver' in window)) return resolve(null);
  let maxLatency = 0;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        const latency = entry.processingStart && entry.startTime ? entry.processingStart - entry.startTime : entry.duration || 0;
        if (latency > maxLatency) maxLatency = latency;
      }
    });
    observer.observe({ type: 'event', buffered: true, durationThreshold: 40 } as any);
    window.setTimeout(() => {
      observer.disconnect();
      resolve(maxLatency ? round(maxLatency) : null);
    }, 0);
  } catch {
    resolve(null);
  }
});

const getResourceSummary = () => {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const backendResources = resources.filter((r) => /\/rest\/v1|\/functions\/v1|supabase\.co/i.test(r.name));
  const featuredResources = backendResources.filter((r) => /get_featured_providers|featured_providers/i.test(r.name));
  const imageResources = resources.filter((r) => r.initiatorType === 'img' || /\.(webp|png|jpe?g)(\?|$)/i.test(r.name));
  const scripts = resources.filter((r) => r.initiatorType === 'script');
  const featuredRuntime = typeof window !== 'undefined' ? (window as any).__featuredProvidersMetrics || {} : {};

  const slowBackend = backendResources
    .filter((r) => r.duration >= SLOW_BACKEND_MS)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 8)
    .map((r) => ({ name: new URL(r.name).pathname, duration: round(r.duration), transferSize: r.transferSize || 0 }));

  return {
    resources: {
      total: resources.length,
      scripts: scripts.length,
      images: imageResources.length,
      totalTransferKb: round(resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024),
      imageTransferKb: round(imageResources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024),
      jsTransferKb: round(scripts.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024),
    },
    backend: {
      requestCount: backendResources.length,
      totalDurationMs: round(backendResources.reduce((sum, r) => sum + r.duration, 0)),
      maxDurationMs: round(Math.max(0, ...backendResources.map((r) => r.duration))),
      slowRequests: slowBackend,
    },
    featuredProviders: {
      renderMs: featuredRuntime.renderMs || 0,
      queryTtfbMs: featuredRuntime.queryMs || round(Math.max(0, ...featuredResources.map((r) => r.responseStart - r.requestStart))),
      payloadKb: featuredRuntime.payloadBytes ? round(featuredRuntime.payloadBytes / 1024) : round(featuredResources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024),
      providersRendered: featuredRuntime.providersRendered || featuredRuntime.renderedRows || 0,
      fallbackMode: !!featuredRuntime.fallbackMode,
      sortBy: featuredRuntime.sortBy || null,
    },
  };
};

const detectBottlenecks = (vitals: Vitals, backend: Record<string, any>, resources: Record<string, any>) => {
  const bottlenecks: string[] = [];
  if ((vitals.lcp || 0) > SLOW_LCP_MS) bottlenecks.push('LCP acima do ideal: revisar imagem/hero e JavaScript inicial.');
  if ((vitals.ttfb || 0) > SLOW_TTFB_MS) bottlenecks.push('TTFB alto: revisar cache HTTP/CDN e chamadas iniciais ao backend.');
  if ((backend.maxDurationMs || 0) > SLOW_BACKEND_MS) bottlenecks.push('Backend com requisições lentas: revisar índices, limites e overfetch.');
  if ((resources.jsTransferKb || 0) > 450) bottlenecks.push('JavaScript inicial pesado: ampliar code-splitting e remover dependências de rota.');
  if ((resources.imageTransferKb || 0) > 900) bottlenecks.push('Imagens pesadas: revisar WebP/PNG, srcset e dimensões renderizadas.');
  return bottlenecks;
};

export const installPerformanceTelemetry = () => {
  if (typeof window === 'undefined' || !('performance' in window)) return;
  if ((window as any).__performanceTelemetryInstalled) return;
  (window as any).__performanceTelemetryInstalled = true;

  window.setTimeout(async () => {
    try {
      const nav = getNavigation();
      const [lcp, cls, inp] = await Promise.all([getLcp(), getCls(), getInp()]);
      const vitals: Vitals = {
        ttfb: nav ? round(nav.responseStart - nav.requestStart) : 0,
        fcp: round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0),
        lcp: lcp || 0,
        cls,
        inp: inp || 0,
        domComplete: nav ? round(nav.domComplete) : 0,
      };
      const summary = getResourceSummary();
      const bottlenecks = detectBottlenecks(vitals, summary.backend, summary.resources);

      await (supabase.from('performance_reports' as any) as any).insert({
        route: window.location.pathname,
        navigation_type: nav?.type || 'unknown',
        vitals,
        resources: summary.resources,
        backend: { ...summary.backend, featuredProviders: summary.featuredProviders },
        bottlenecks,
        user_agent: navigator.userAgent.slice(0, 512),
        viewport: `${window.innerWidth}x${window.innerHeight}@${round(window.devicePixelRatio || 1)}`,
        connection_type: (navigator as any).connection?.effectiveType || null,
      });
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[performance] report skipped', error);
    }
  }, REPORT_DELAY_MS);
};