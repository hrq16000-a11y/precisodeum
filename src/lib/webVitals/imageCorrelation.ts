/**
 * imageCorrelation — cruza os sinais de imagem (`IMG_ERROR` / `IMG_DEGRADED`)
 * com o LCP por rota e por dia, para identificar rapidamente regressões
 * causadas por AVIF/WebP, srcSet, sizes ou blur-up ausentes.
 *
 * 100% puro (sem I/O) — o admin passa as amostras de `web_vitals_log`.
 */

import { normalizeRoute, percentile, rateMetric, type Rating, type VitalSample } from './summary';

export const IMG_ERROR_METRIC = 'IMG_ERROR';
export const IMG_DEGRADED_METRIC = 'IMG_DEGRADED';

export type CorrelationVerdict = 'ok' | 'suspeita' | 'provavel_causa';

export interface RouteImageCorrelation {
  route: string;
  lcpSamples: number;
  lcpP75: number | null;
  lcpRating: Rating;
  /** Média de imagens quebradas por pageview. */
  errorsPerView: number;
  /** Média de imagens fora do contrato por pageview. */
  degradedPerView: number;
  /** % de pageviews com ao menos uma falha/degradação. */
  affectedRate: number;
  /** Delta de LCP p75 entre pageviews com e sem problema de imagem (ms). */
  lcpDeltaMs: number | null;
  verdict: CorrelationVerdict;
}

const avg = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

const groupByRoute = (samples: VitalSample[]) => {
  const map = new Map<string, VitalSample[]>();
  for (const s of samples) {
    const route = normalizeRoute(s.route);
    const bucket = map.get(route);
    if (bucket) bucket.push(s);
    else map.set(route, [s]);
  }
  return map;
};

/** Chave de pageview: rota + timestamp do flush (as métricas vão no mesmo lote). */
const pageviewKey = (s: VitalSample) => `${normalizeRoute(s.route)}|${s.created_at}`;

/**
 * Correlaciona por rota. `minSamples` descarta rotas com volume insuficiente
 * para evitar falso positivo.
 */
export function correlateImagesWithLcp(
  samples: VitalSample[],
  minSamples = 3,
): RouteImageCorrelation[] {
  // Agrupa por pageview para saber se aquele LCP conviveu com falha de imagem.
  const views = new Map<string, { route: string; lcp: number | null; errors: number; degraded: number }>();
  for (const s of samples) {
    const key = pageviewKey(s);
    const view = views.get(key) ?? {
      route: normalizeRoute(s.route),
      lcp: null,
      errors: 0,
      degraded: 0,
    };
    if (s.metric === 'LCP') view.lcp = s.value;
    if (s.metric === IMG_ERROR_METRIC) view.errors += s.value;
    if (s.metric === IMG_DEGRADED_METRIC) view.degraded += s.value;
    views.set(key, view);
  }

  const byRoute = new Map<string, Array<ReturnType<typeof Object> & { lcp: number | null; errors: number; degraded: number }>>();
  views.forEach((v) => {
    const bucket = byRoute.get(v.route);
    if (bucket) bucket.push(v as never);
    else byRoute.set(v.route, [v as never]);
  });

  const rows: RouteImageCorrelation[] = [];
  byRoute.forEach((list, route) => {
    const withLcp = list.filter((v) => typeof v.lcp === 'number') as Array<{
      lcp: number; errors: number; degraded: number;
    }>;
    if (withLcp.length < minSamples) return;

    const lcpP75 = percentile(withLcp.map((v) => v.lcp), 75);
    const affected = withLcp.filter((v) => v.errors > 0 || v.degraded > 0);
    const clean = withLcp.filter((v) => v.errors === 0 && v.degraded === 0);

    const affectedP75 = percentile(affected.map((v) => v.lcp), 75);
    const cleanP75 = percentile(clean.map((v) => v.lcp), 75);
    const lcpDeltaMs =
      affectedP75 !== null && cleanP75 !== null ? Math.round(affectedP75 - cleanP75) : null;

    const errorsPerView = Math.round(avg(withLcp.map((v) => v.errors)) * 100) / 100;
    const degradedPerView = Math.round(avg(withLcp.map((v) => v.degraded)) * 100) / 100;
    const affectedRate = Math.round((affected.length / withLcp.length) * 100);
    const lcpRating = lcpP75 === null ? 'good' : rateMetric('LCP', lcpP75);

    let verdict: CorrelationVerdict = 'ok';
    const hasIssue = errorsPerView > 0 || degradedPerView > 0;
    if (hasIssue && lcpRating !== 'good') {
      verdict = lcpDeltaMs !== null && lcpDeltaMs >= 300 ? 'provavel_causa' : 'suspeita';
    } else if (hasIssue) {
      verdict = 'suspeita';
    }

    rows.push({
      route,
      lcpSamples: withLcp.length,
      lcpP75,
      lcpRating,
      errorsPerView,
      degradedPerView,
      affectedRate,
      lcpDeltaMs,
      verdict,
    });
  });

  const WEIGHT: Record<CorrelationVerdict, number> = { provavel_causa: 2, suspeita: 1, ok: 0 };
  return rows.sort(
    (a, b) => WEIGHT[b.verdict] - WEIGHT[a.verdict] || (b.lcpDeltaMs ?? 0) - (a.lcpDeltaMs ?? 0),
  );
}

export interface ImageDailyPoint {
  day: string;
  lcpP75: number | null;
  errors: number;
  degraded: number;
}

/** Série diária para sobrepor picos de LCP às falhas de imagem. */
export function imageLcpDaily(samples: VitalSample[]): ImageDailyPoint[] {
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
      lcpP75: percentile(rows.filter((r) => r.metric === 'LCP').map((r) => r.value), 75),
      errors: rows.filter((r) => r.metric === IMG_ERROR_METRIC).reduce((a, r) => a + r.value, 0),
      degraded: rows.filter((r) => r.metric === IMG_DEGRADED_METRIC).reduce((a, r) => a + r.value, 0),
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** Pearson entre problemas de imagem e LCP p75 diário (−1..1, null se insuficiente). */
export function pearsonImageLcp(points: ImageDailyPoint[]): number | null {
  const usable = points.filter((p) => p.lcpP75 !== null);
  if (usable.length < 3) return null;
  const xs = usable.map((p) => p.errors + p.degraded);
  const ys = usable.map((p) => p.lcpP75 as number);
  const mx = avg(xs);
  const my = avg(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return Math.round((num / Math.sqrt(dx * dy)) * 100) / 100;
}

/** Ranking dos problemas mais frequentes (para priorizar a correção). */
export function topImageIssues(rows: RouteImageCorrelation[], limit = 5) {
  return rows
    .filter((r) => r.errorsPerView > 0 || r.degradedPerView > 0)
    .slice(0, limit)
    .map((r) => ({
      route: r.route,
      impact: (r.lcpDeltaMs ?? 0) + r.errorsPerView * 100,
      verdict: r.verdict,
    }));
}
