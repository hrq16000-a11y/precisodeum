/**
 * webVitals/summary — agregação pura (sem I/O) de amostras de `web_vitals_log`.
 *
 * Usado pelo painel /admin/seo/web-vitals e pelo overlay de diagnóstico das
 * páginas públicas. Mantido puro para ser testável sem banco.
 */

export type CoreMetric = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';
export type Rating = 'good' | 'needs-improvement' | 'poor';

export const CORE_METRICS: CoreMetric[] = ['LCP', 'CLS', 'INP'];

export interface VitalSample {
  metric: string;
  value: number;
  route: string;
  rating?: string | null;
  viewport?: string | null;
  created_at: string;
}

/** Limiares oficiais do Google (web.dev/vitals). */
export const THRESHOLDS: Record<CoreMetric, { good: number; poor: number; unit: 'ms' | '' }> = {
  LCP: { good: 2500, poor: 4000, unit: 'ms' },
  INP: { good: 200, poor: 500, unit: 'ms' },
  CLS: { good: 0.1, poor: 0.25, unit: '' },
  FCP: { good: 1800, poor: 3000, unit: 'ms' },
  TTFB: { good: 800, poor: 1800, unit: 'ms' },
};

export function rateMetric(metric: string, value: number): Rating {
  const t = THRESHOLDS[metric as CoreMetric];
  if (!t) return 'good';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  const v = sorted[idx];
  return Math.round(v * 1000) / 1000;
}

export interface MetricSummary {
  metric: string;
  samples: number;
  p50: number | null;
  p75: number | null;
  p95: number | null;
  good: number;
  needsImprovement: number;
  poor: number;
  /** Percentual de amostras "good" (0–100). */
  goodRate: number;
  rating: Rating;
}

export function summarizeMetric(metric: string, samples: VitalSample[]): MetricSummary {
  const values = samples.filter((s) => s.metric === metric).map((s) => s.value);
  const ratings = values.map((v) => rateMetric(metric, v));
  const good = ratings.filter((r) => r === 'good').length;
  const needsImprovement = ratings.filter((r) => r === 'needs-improvement').length;
  const poor = ratings.filter((r) => r === 'poor').length;
  const p75v = percentile(values, 75);
  return {
    metric,
    samples: values.length,
    p50: percentile(values, 50),
    p75: p75v,
    p95: percentile(values, 95),
    good,
    needsImprovement,
    poor,
    goodRate: values.length ? Math.round((good / values.length) * 100) : 0,
    rating: p75v === null ? 'good' : rateMetric(metric, p75v),
  };
}

export interface RouteVitals {
  route: string;
  samples: number;
  lcpP75: number | null;
  clsP75: number | null;
  inpP75: number | null;
  worst: Rating;
}

const RATING_WEIGHT: Record<Rating, number> = { good: 0, 'needs-improvement': 1, poor: 2 };

/** Normaliza `/categoria/eletricista?x=1` → `/categoria/eletricista`. */
export function normalizeRoute(path: string): string {
  const clean = (path || '/').split('?')[0].split('#')[0].replace(/\/+$/, '');
  return clean || '/';
}

export function summarizeByRoute(samples: VitalSample[], minSamples = 1): RouteVitals[] {
  const byRoute = new Map<string, VitalSample[]>();
  for (const s of samples) {
    const route = normalizeRoute(s.route);
    const bucket = byRoute.get(route);
    if (bucket) bucket.push(s);
    else byRoute.set(route, [s]);
  }

  const rows: RouteVitals[] = [];
  byRoute.forEach((rows_, route) => {
    if (rows_.length < minSamples) return;
    const lcp = summarizeMetric('LCP', rows_);
    const cls = summarizeMetric('CLS', rows_);
    const inp = summarizeMetric('INP', rows_);
    const worst = [lcp, cls, inp]
      .filter((m) => m.samples > 0)
      .reduce<Rating>(
        (acc, m) => (RATING_WEIGHT[m.rating] > RATING_WEIGHT[acc] ? m.rating : acc),
        'good',
      );
    rows.push({
      route,
      samples: rows_.length,
      lcpP75: lcp.p75,
      clsP75: cls.p75,
      inpP75: inp.p75,
      worst,
    });
  });

  return rows.sort((a, b) => RATING_WEIGHT[b.worst] - RATING_WEIGHT[a.worst] || b.samples - a.samples);
}

/** Classifica um viewport "1280x800" em desktop/mobile para segmentar. */
export function deviceOf(viewport?: string | null): 'mobile' | 'desktop' | 'unknown' {
  if (!viewport) return 'unknown';
  const width = Number(String(viewport).split('x')[0]);
  if (!Number.isFinite(width) || width <= 0) return 'unknown';
  return width <= 768 ? 'mobile' : 'desktop';
}

export interface DailyPoint {
  day: string;
  lcpP75: number | null;
  clsP75: number | null;
  inpP75: number | null;
  samples: number;
}

export function summarizeDaily(samples: VitalSample[]): DailyPoint[] {
  const byDay = new Map<string, VitalSample[]>();
  for (const s of samples) {
    const day = s.created_at.slice(0, 10);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(s);
    else byDay.set(day, [s]);
  }
  return [...byDay.entries()]
    .map(([day, rows]) => ({
      day,
      lcpP75: summarizeMetric('LCP', rows).p75,
      clsP75: summarizeMetric('CLS', rows).p75,
      inpP75: summarizeMetric('INP', rows).p75,
      samples: rows.length,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function formatMetric(metric: string, value: number | null): string {
  if (value === null) return '—';
  if (metric === 'CLS') return value.toFixed(3);
  return `${Math.round(value)} ms`;
}
