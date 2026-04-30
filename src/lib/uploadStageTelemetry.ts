/**
 * uploadStageTelemetry — registra latência e sucesso/falha por etapa do pipeline
 * de upload (resize / convert / compress / upload / fallback).
 *
 * Reaproveita a tabela `upload_test_results` (RLS por user, admin lê tudo).
 * Em produção normal cada upload gera ~5 linhas — leve e correlacionável com
 * `effective_type` e `device_ua`. Sempre best-effort: nunca derruba o fluxo.
 */

import { supabase } from '@/integrations/supabase/client';
import { getUploadTestMode } from './uploadTestMode';

export type UploadStage = 'resize' | 'convert' | 'compress' | 'upload' | 'fallback';

export interface StageTelemetryInput {
  stage: UploadStage;
  success: boolean;
  latencyMs: number;
  fileSizeBytes?: number;
  errorCode?: string;
  /** Classificação padronizada do erro (timeout/network/server/convert/...). */
  errorKind?: string;
  fallbackLevel?: number;
}

interface DeviceInfo {
  ua: string;
  effectiveType: string | null;
  downlink: number | null;
}

function readDeviceInfo(): DeviceInfo {
  const conn =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;
  return {
    ua: navigator.userAgent.slice(0, 500),
    effectiveType: conn?.effectiveType ?? null,
    downlink: typeof conn?.downlink === 'number' ? conn.downlink : null,
  };
}

/** Persiste uma medição de etapa (best-effort). */
export async function recordStageTelemetry(input: StageTelemetryInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const dev = readDeviceInfo();
    const scenario = getUploadTestMode().scenario;
    await supabase.from('upload_test_results').insert({
      user_id: user.id,
      scenario: scenario === 'off' ? 'production' : scenario,
      attempts: 1,
      success: input.success,
      total_ms: Math.round(input.latencyMs),
      stage: input.stage,
      stage_latency_ms: Math.round(input.latencyMs),
      file_size_bytes: input.fileSizeBytes ?? null,
      error_code: input.errorCode ?? null,
      error_kind: input.errorKind ?? null,
      fallback_level: input.fallbackLevel ?? null,
      device_ua: dev.ua,
      effective_type: dev.effectiveType,
      downlink_mbps: dev.downlink,
    } as any);
  } catch (err) {
    console.warn('[uploadStageTelemetry] failed', err);
  }
}

/** Cronometra uma função e registra sucesso/falha automaticamente. */
export async function withStageTelemetry<T>(
  stage: UploadStage,
  fn: () => Promise<T>,
  meta?: { fileSizeBytes?: number; fallbackLevel?: number }
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    recordStageTelemetry({
      stage,
      success: true,
      latencyMs: performance.now() - start,
      fileSizeBytes: meta?.fileSizeBytes,
      fallbackLevel: meta?.fallbackLevel,
    });
    return result;
  } catch (err: any) {
    // Lazy import pra evitar ciclo (uploadErrors importa UploadTimeoutError de uploadResilient)
    const { classifyUploadError } = await import('./uploadErrors');
    recordStageTelemetry({
      stage,
      success: false,
      latencyMs: performance.now() - start,
      fileSizeBytes: meta?.fileSizeBytes,
      errorCode: err?.message?.slice(0, 200) || 'unknown',
      errorKind: classifyUploadError(err),
      fallbackLevel: meta?.fallbackLevel,
    });
    throw err;
  }
}
