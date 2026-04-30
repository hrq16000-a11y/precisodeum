/**
 * uploadTestMode — Modo de teste de stress para uploads.
 *
 * Permite simular cenários de rede degradada (Slow 3G / Fast 3G / 4G / Wi-Fi)
 * e injetar falhas determinísticas para validar o `resilientUpload` SEM precisar
 * do DevTools throttling. Resultados são gravados em `upload_test_results` para
 * análise por dispositivo (taxa de sucesso, tempo médio, retries).
 *
 * Ativação: o painel admin chama `setUploadTestMode({...})`. O `resilientUpload`
 * lê o estado via `getUploadTestMode()` e aplica latência/falha. Em produção
 * normal o módulo é inerte (overhead zero quando inativo).
 */

import { supabase } from '@/integrations/supabase/client';

export type NetworkScenario = 'off' | 'slow_3g' | 'fast_3g' | '4g' | 'wifi';

export interface ScenarioProfile {
  /** Latência adicional artificial por chunk (ms). */
  latencyMs: number;
  /** Probabilidade [0..1] de o fetch falhar com TypeError simulado. */
  failureRate: number;
  /** Probabilidade [0..1] de timeout (abort após `timeoutMs` do resilientUpload). */
  timeoutRate: number;
}

export const SCENARIO_PROFILES: Record<Exclude<NetworkScenario, 'off'>, ScenarioProfile> = {
  slow_3g: { latencyMs: 2000, failureRate: 0.30, timeoutRate: 0.15 },
  fast_3g: { latencyMs: 800,  failureRate: 0.15, timeoutRate: 0.05 },
  '4g':    { latencyMs: 200,  failureRate: 0.05, timeoutRate: 0.02 },
  wifi:    { latencyMs: 50,   failureRate: 0.01, timeoutRate: 0.00 },
};

interface UploadTestState {
  scenario: NetworkScenario;
  /** Override opcional do perfil (útil pra teste manual). */
  override?: Partial<ScenarioProfile>;
}

let state: UploadTestState = { scenario: 'off' };

export function setUploadTestMode(next: UploadTestState) {
  state = next;
  if (typeof window !== 'undefined') {
    if (next.scenario === 'off') {
      sessionStorage.removeItem('upload_test_mode');
    } else {
      sessionStorage.setItem('upload_test_mode', JSON.stringify(next));
    }
  }
}

export function getUploadTestMode(): UploadTestState {
  if (state.scenario !== 'off') return state;
  if (typeof window !== 'undefined') {
    const raw = sessionStorage.getItem('upload_test_mode');
    if (raw) {
      try {
        state = JSON.parse(raw);
      } catch { /* noop */ }
    }
  }
  return state;
}

export function isUploadTestActive(): boolean {
  return getUploadTestMode().scenario !== 'off';
}

/** Resolve o perfil ativo (com override). Retorna null se inativo. */
export function getActiveProfile(): ScenarioProfile | null {
  const s = getUploadTestMode();
  if (s.scenario === 'off') return null;
  return { ...SCENARIO_PROFILES[s.scenario], ...(s.override ?? {}) };
}

/** Sleep determinístico baseado no perfil ativo (no-op se inativo). */
export async function applyTestLatency(): Promise<void> {
  const p = getActiveProfile();
  if (!p || p.latencyMs <= 0) return;
  await new Promise((r) => setTimeout(r, p.latencyMs));
}

/** Decide se a tentativa atual deve falhar (sorteio com base no perfil). */
export function shouldSimulateFailure(): 'network' | 'timeout' | null {
  const p = getActiveProfile();
  if (!p) return null;
  const r = Math.random();
  if (r < p.timeoutRate) return 'timeout';
  if (r < p.timeoutRate + p.failureRate) return 'network';
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Telemetria — registra resultado por dispositivo
// ─────────────────────────────────────────────────────────────────

interface DeviceInfo {
  ua: string;
  effectiveType: string | null;
  downlink: number | null;
}

function readDeviceInfo(): DeviceInfo {
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  return {
    ua: navigator.userAgent.slice(0, 500),
    effectiveType: conn?.effectiveType ?? null,
    downlink: typeof conn?.downlink === 'number' ? conn.downlink : null,
  };
}

export interface RecordTestResultInput {
  scenario: NetworkScenario;
  attempts: number;
  success: boolean;
  totalMs: number;
  fileSizeBytes?: number;
  errorCode?: string;
}

/** Persiste o resultado em `upload_test_results` (best-effort). */
export async function recordUploadTestResult(input: RecordTestResultInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const dev = readDeviceInfo();
    await supabase.from('upload_test_results').insert({
      user_id: user.id,
      scenario: input.scenario,
      attempts: input.attempts,
      success: input.success,
      total_ms: Math.round(input.totalMs),
      file_size_bytes: input.fileSizeBytes ?? null,
      error_code: input.errorCode ?? null,
      device_ua: dev.ua,
      effective_type: dev.effectiveType,
      downlink_mbps: dev.downlink,
    });
  } catch (err) {
    console.warn('[uploadTestMode] failed to record result', err);
  }
}
