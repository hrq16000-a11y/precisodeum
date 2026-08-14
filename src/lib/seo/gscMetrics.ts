/**
 * Métricas de submissão ao Google Search Console (janela móvel, padrão 7 dias).
 *
 * Fonte única: `gsc_audit_log` (action = 'submit-sitemap').
 * Camada 100% pura — a página `/admin/seo/metricas` e os testes usam os mesmos helpers.
 * Nada aqui inventa número: quando não há dado de latência, o valor é `null`.
 */

import { RUN_WINDOW_MS, isSubmissionRow, sitemapGroup, type GscAuditRow } from "./gscSubmissions";
import { partitionKey } from "./gscSubmissionFilters";

export type GscMetricsRow = GscAuditRow & {
  /** Latência da chamada à API do GSC, quando registrada pela edge function. */
  duration_ms?: number | null;
};

export type MetricBucket = {
  key: string;
  total: number;
  ok: number;
  failed: number;
  /** 0..1 */
  failureRate: number;
  /** Participação (0..1) do bucket no total de submissões da janela. */
  share: number;
  avgMs: number | null;
  p95Ms: number | null;
  lastAt: string | null;
  lastOk: boolean | null;
};

export type DailyPoint = {
  /** yyyy-mm-dd (UTC) */
  date: string;
  total: number;
  failed: number;
  failureRate: number;
  avgMs: number | null;
};

export type GscMetrics = {
  windowDays: number;
  from: string;
  to: string;
  total: number;
  ok: number;
  failed: number;
  failureRate: number;
  runs: number;
  avgMs: number | null;
  p95Ms: number | null;
  perSitemap: MetricBucket[];
  perPartition: MetricBucket[];
  daily: DailyPoint[];
};

/** Percentil linear simples. Retorna `null` para amostra vazia. */
export function percentile(values: number[], p: number): number | null {
  const sample = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sample.length === 0) return null;
  const idx = Math.min(sample.length - 1, Math.max(0, Math.ceil((p / 100) * sample.length) - 1));
  return Math.round(sample[idx]);
}

const mean = (values: number[]): number | null => {
  const sample = values.filter((v) => Number.isFinite(v));
  if (sample.length === 0) return null;
  return Math.round(sample.reduce((a, b) => a + b, 0) / sample.length);
};

const dayKey = (iso: string) => iso.slice(0, 10);

function bucketize(
  rows: GscMetricsRow[],
  keyOf: (row: GscMetricsRow) => string,
  grandTotal: number,
): MetricBucket[] {
  const map = new Map<string, GscMetricsRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }

  return Array.from(map.entries())
    .map(([key, list]) => {
      const ordered = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const last = ordered[ordered.length - 1];
      const failed = ordered.filter((r) => !r.ok).length;
      const durations = ordered
        .map((r) => (typeof r.duration_ms === "number" ? r.duration_ms : NaN))
        .filter((n) => Number.isFinite(n));
      return {
        key,
        total: ordered.length,
        ok: ordered.length - failed,
        failed,
        failureRate: ordered.length === 0 ? 0 : failed / ordered.length,
        share: grandTotal === 0 ? 0 : ordered.length / grandTotal,
        avgMs: mean(durations),
        p95Ms: percentile(durations, 95),
        lastAt: last?.created_at ?? null,
        lastOk: last ? last.ok : null,
      } satisfies MetricBucket;
    })
    .sort((a, b) => b.failed - a.failed || b.total - a.total || a.key.localeCompare(b.key, "pt-BR"));
}

/** Conta rodadas distintas agrupando linhas próximas no tempo (mesma janela do histórico). */
export function countRuns(rows: GscMetricsRow[]): number {
  const times = rows.map((r) => new Date(r.created_at).getTime()).sort((a, b) => a - b);
  if (times.length === 0) return 0;
  let runs = 1;
  for (let i = 1; i < times.length; i += 1) {
    if (times[i] - times[i - 1] > RUN_WINDOW_MS) runs += 1;
  }
  return runs;
}

export function computeGscMetrics(
  rows: GscMetricsRow[],
  opts: { days?: number; now?: Date } = {},
): GscMetrics {
  const days = opts.days ?? 7;
  const now = opts.now ?? new Date();
  const to = now.toISOString();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  const scoped = rows
    .filter(isSubmissionRow)
    .filter((r) => r.created_at >= from && r.created_at <= to);

  const failed = scoped.filter((r) => !r.ok).length;
  const durations = scoped
    .map((r) => (typeof r.duration_ms === "number" ? r.duration_ms : NaN))
    .filter((n) => Number.isFinite(n));

  const dailyMap = new Map<string, GscMetricsRow[]>();
  for (const row of scoped) {
    const key = dayKey(row.created_at);
    const list = dailyMap.get(key);
    if (list) list.push(row);
    else dailyMap.set(key, [row]);
  }

  const daily: DailyPoint[] = Array.from(dailyMap.entries())
    .map(([date, list]) => {
      const dayFailed = list.filter((r) => !r.ok).length;
      return {
        date,
        total: list.length,
        failed: dayFailed,
        failureRate: list.length === 0 ? 0 : dayFailed / list.length,
        avgMs: mean(
          list
            .map((r) => (typeof r.duration_ms === "number" ? r.duration_ms : NaN))
            .filter((n) => Number.isFinite(n)),
        ),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    windowDays: days,
    from,
    to,
    total: scoped.length,
    ok: scoped.length - failed,
    failed,
    failureRate: scoped.length === 0 ? 0 : failed / scoped.length,
    runs: countRuns(scoped),
    avgMs: mean(durations),
    p95Ms: percentile(durations, 95),
    perSitemap: bucketize(scoped, (r) => sitemapGroup(r.sitemap as string), scoped.length),
    perPartition: bucketize(scoped, (r) => partitionKey(r.sitemap as string), scoped.length),
    daily,
  };
}

/** Formata 0..1 como percentual pt-BR com 1 casa. */
export function pct(value: number): string {
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/** Formata latência em ms → "820 ms" / "1,2 s". `null` vira "—". */
export function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
}
