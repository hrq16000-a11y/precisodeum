/**
 * adaptiveCompression — calibra thresholds de compressão (qualidade/tamanho/dim)
 * a partir de métricas RECENTES de falha por (effective_type, downlink, device).
 *
 * Loop fechado: redes que estão falhando muito recebem perfil mais agressivo
 * (resoluções menores, alvo em KB menor) ANTES da primeira tentativa, reduzindo
 * a chance de retry. Resultados da RPC `upload_failure_stats` são cacheados por
 * 30 min em localStorage — zero overhead no caminho quente.
 */

import { supabase } from '@/integrations/supabase/client';

export interface AdaptiveProfile {
  /** Lado máximo (px) sugerido pra compressão. */
  maxDimension: number;
  /** Tamanho-alvo em KB. */
  targetKB: number;
  /** Origem do perfil (debug/telemetria). */
  source: 'baseline' | 'mild_degraded' | 'degraded' | 'severely_degraded';
  /** Taxa de falha recente observada nessa coorte (0..1). */
  observedFailRate: number;
  /** Tamanho da amostra que originou a recomendação. */
  sampleSize: number;
}

const CACHE_KEY = 'pdu_adaptive_compression_v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

interface FailureStatsRow {
  effective_type: string;
  downlink_band: string;
  device_family: string;
  total: number;
  failures: number;
  fail_rate: number;
  avg_total_ms: number;
  avg_attempts: number;
}

interface CachedStats {
  ts: number;
  rows: FailureStatsRow[];
}

const readCache = (): CachedStats | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedStats;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (rows: FailureStatsRow[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rows }));
  } catch {
    /* localStorage indisponível (private mode) — segue o jogo */
  }
};

/** Refresca métricas em background (best-effort). Retorna `true` se atualizou. */
export async function refreshAdaptiveStats(lookbackHours = 24): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('upload_failure_stats', {
      _lookback_hours: lookbackHours,
    });
    if (error || !Array.isArray(data)) return false;
    writeCache(data as FailureStatsRow[]);
    return true;
  } catch {
    return false;
  }
}

/** Lê hints atuais de rede/dispositivo. */
function readContext() {
  if (typeof navigator === 'undefined') {
    return { effectiveType: 'unknown', downlinkBand: 'unknown', deviceFamily: 'desktop' };
  }
  const conn = (navigator as any).connection;
  const effectiveType = (conn?.effectiveType as string) ?? 'unknown';
  const downlink = typeof conn?.downlink === 'number' ? conn.downlink : null;

  let downlinkBand = 'unknown';
  if (downlink != null) {
    if (downlink < 0.5) downlinkBand = '<0.5';
    else if (downlink < 1.5) downlinkBand = '0.5-1.5';
    else if (downlink < 5) downlinkBand = '1.5-5';
    else downlinkBand = '5+';
  }

  const ua = navigator.userAgent.toLowerCase();
  let deviceFamily = 'desktop';
  if (/ipad|tablet/.test(ua)) deviceFamily = 'tablet';
  else if (/android|iphone|mobile/.test(ua)) deviceFamily = 'mobile';

  return { effectiveType, downlinkBand, deviceFamily };
}

/** Tenta achar um match na coorte mais específica disponível. */
function pickRow(rows: FailureStatsRow[], ctx: ReturnType<typeof readContext>): FailureStatsRow | null {
  // 1) match exato (et + downlink + device)
  const exact = rows.find(
    (r) =>
      r.effective_type === ctx.effectiveType &&
      r.downlink_band === ctx.downlinkBand &&
      r.device_family === ctx.deviceFamily
  );
  if (exact && exact.total >= 5) return exact;

  // 2) et + device (qualquer downlink)
  const byEtDevice = rows
    .filter((r) => r.effective_type === ctx.effectiveType && r.device_family === ctx.deviceFamily)
    .sort((a, b) => b.total - a.total)[0];
  if (byEtDevice && byEtDevice.total >= 5) return byEtDevice;

  // 3) só effective_type
  const byEt = rows
    .filter((r) => r.effective_type === ctx.effectiveType)
    .sort((a, b) => b.total - a.total)[0];
  if (byEt && byEt.total >= 5) return byEt;

  return null;
}

/**
 * Mapeia taxa de falha em perfil de compressão. Quanto pior a coorte, mais
 * agressiva a compressão (menos pixels, menos KB).
 *
 * Limiares:
 *   - <10%  → baseline (sem mexer no que o caller pediu)
 *   - 10-25%→ mild_degraded (-15% target, -10% dim)
 *   - 25-50%→ degraded     (-30% target, -25% dim)
 *   - >50%  → severely_degraded (-50% target, -40% dim)
 */
export function deriveAdaptiveProfile(
  baselineMaxDim: number,
  baselineTargetKB: number,
  rows: FailureStatsRow[] | null,
  ctx = readContext()
): AdaptiveProfile {
  const row = rows ? pickRow(rows, ctx) : null;
  const failRate = row?.fail_rate ?? 0;

  let source: AdaptiveProfile['source'] = 'baseline';
  let dimMul = 1;
  let kbMul = 1;

  if (failRate >= 0.5) {
    source = 'severely_degraded';
    dimMul = 0.6;
    kbMul = 0.5;
  } else if (failRate >= 0.25) {
    source = 'degraded';
    dimMul = 0.75;
    kbMul = 0.7;
  } else if (failRate >= 0.1) {
    source = 'mild_degraded';
    dimMul = 0.9;
    kbMul = 0.85;
  }

  // Redes muito ruins (slow-2g/2g) sempre escalam o degradê pelo menos um nível,
  // mesmo sem amostra suficiente — sinal a priori vale mais que ausência de dado.
  if ((ctx.effectiveType === '2g' || ctx.effectiveType === 'slow-2g') && source === 'baseline') {
    source = 'mild_degraded';
    dimMul = 0.85;
    kbMul = 0.8;
  }

  return {
    maxDimension: Math.max(480, Math.round(baselineMaxDim * dimMul)),
    targetKB: Math.max(80, Math.round(baselineTargetKB * kbMul)),
    source,
    observedFailRate: failRate,
    sampleSize: row?.total ?? 0,
  };
}

/**
 * Resolve o perfil a aplicar AGORA. Usa cache local (sync-fast) e dispara
 * refresh em background quando expirado. Nunca bloqueia o pipeline de upload.
 */
export function resolveAdaptiveProfile(
  baselineMaxDim: number,
  baselineTargetKB: number
): AdaptiveProfile {
  const cached = readCache();
  // Refresh em background se vencido (não aguarda)
  if (!cached) void refreshAdaptiveStats();
  return deriveAdaptiveProfile(baselineMaxDim, baselineTargetKB, cached?.rows ?? null);
}
