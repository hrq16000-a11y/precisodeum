/**
 * Limiares configuráveis de alerta do Google Search Console.
 *
 * Puro (sem I/O): a UI carrega/salva em `site_settings.gsc_alert_thresholds`
 * e os testes consomem exatamente os mesmos helpers.
 *
 * Fail-closed em dado ausente: métrica sem número NÃO gera alerta verde nem
 * vermelho — vira status "unknown" e a UI mostra "sem dados".
 */

export interface GscThresholds {
  /** % mínimo de URLs indexadas sobre enviadas. */
  minIndexedRatio: number;
  /** Impressões mínimas na janela analisada. */
  minImpressions: number;
  /** Cliques mínimos na janela analisada. */
  minClicks: number;
  /** Nº máximo tolerado de sitemaps com erro. */
  maxSitemapErrors: number;
}

export const DEFAULT_GSC_THRESHOLDS: GscThresholds = {
  minIndexedRatio: 60,
  minImpressions: 100,
  minClicks: 5,
  maxSitemapErrors: 0,
};

const clampNum = (v: unknown, fallback: number, min = 0, max = 1_000_000): number => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

/** Lê o JSON salvo em site_settings, tolerando valor ausente/corrompido. */
export function parseGscThresholds(raw: unknown): GscThresholds {
  let obj: Record<string, unknown> = {};
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') obj = parsed as Record<string, unknown>;
    } catch {
      /* valor corrompido → defaults */
    }
  } else if (raw && typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  }
  return {
    minIndexedRatio: clampNum(obj.minIndexedRatio, DEFAULT_GSC_THRESHOLDS.minIndexedRatio, 0, 100),
    minImpressions: clampNum(obj.minImpressions, DEFAULT_GSC_THRESHOLDS.minImpressions),
    minClicks: clampNum(obj.minClicks, DEFAULT_GSC_THRESHOLDS.minClicks),
    maxSitemapErrors: clampNum(obj.maxSitemapErrors, DEFAULT_GSC_THRESHOLDS.maxSitemapErrors),
  };
}

export function serializeGscThresholds(t: GscThresholds): string {
  return JSON.stringify(parseGscThresholds(t));
}

export type GscThresholdMetric = 'indexed_ratio' | 'impressions' | 'clicks' | 'sitemap_errors';

export interface GscThresholdSample {
  indexedRatio?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  sitemapErrors?: number | null;
}

export interface GscThresholdAlert {
  metric: GscThresholdMetric;
  label: string;
  severity: 'critical' | 'warning';
  value: number;
  threshold: number;
  message: string;
}

export interface GscThresholdStatus {
  metric: GscThresholdMetric;
  label: string;
  status: 'ok' | 'alert' | 'unknown';
  value: number | null;
  threshold: number;
}

const LABEL: Record<GscThresholdMetric, string> = {
  indexed_ratio: 'Taxa de indexação',
  impressions: 'Impressões',
  clicks: 'Cliques',
  sitemap_errors: 'Sitemaps com erro',
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Compara a amostra com os limiares; retorna status por métrica (inclusive "unknown"). */
export function evaluateGscThresholds(
  sample: GscThresholdSample,
  thresholds: GscThresholds = DEFAULT_GSC_THRESHOLDS,
): { statuses: GscThresholdStatus[]; alerts: GscThresholdAlert[] } {
  const t = parseGscThresholds(thresholds);
  const statuses: GscThresholdStatus[] = [];
  const alerts: GscThresholdAlert[] = [];

  const check = (
    metric: GscThresholdMetric,
    value: number | null | undefined,
    threshold: number,
    breached: (v: number) => boolean,
    message: (v: number) => string,
    severity: 'critical' | 'warning',
  ) => {
    if (!isNum(value)) {
      statuses.push({ metric, label: LABEL[metric], status: 'unknown', value: null, threshold });
      return;
    }
    const bad = breached(value);
    statuses.push({ metric, label: LABEL[metric], status: bad ? 'alert' : 'ok', value, threshold });
    if (bad) {
      alerts.push({ metric, label: LABEL[metric], severity, value, threshold, message: message(value) });
    }
  };

  check(
    'indexed_ratio',
    sample.indexedRatio,
    t.minIndexedRatio,
    (v) => v < t.minIndexedRatio,
    (v) => `Taxa de indexação em ${v}% (mínimo configurado: ${t.minIndexedRatio}%).`,
    'critical',
  );
  check(
    'impressions',
    sample.impressions,
    t.minImpressions,
    (v) => v < t.minImpressions,
    (v) => `Apenas ${v} impressões na janela (mínimo: ${t.minImpressions}).`,
    'warning',
  );
  check(
    'clicks',
    sample.clicks,
    t.minClicks,
    (v) => v < t.minClicks,
    (v) => `Apenas ${v} cliques na janela (mínimo: ${t.minClicks}).`,
    'warning',
  );
  check(
    'sitemap_errors',
    sample.sitemapErrors,
    t.maxSitemapErrors,
    (v) => v > t.maxSitemapErrors,
    (v) => `${v} sitemap(s) com erro (tolerado: ${t.maxSitemapErrors}).`,
    'critical',
  );

  return { statuses, alerts };
}
