/**
 * uploadResilient — Wrapper de upload com retry exponencial e timeout.
 *
 * Foco: redes 3G/4G instáveis. Detecta timeout, falhas de rede e respostas 5xx
 * e re-tenta automaticamente com backoff. Não trata erros 4xx (problema do
 * cliente — re-tentar não vai resolver).
 *
 * Também observa `uploadTestMode`: quando ativo, injeta latência e falhas
 * simuladas e grava a métrica em `upload_test_results`. Em produção normal
 * o overhead é zero (test mode inativo = curto-circuito).
 */

import {
  applyTestLatency,
  getUploadTestMode,
  isUploadTestActive,
  recordUploadTestResult,
  shouldSimulateFailure,
} from './uploadTestMode';

export interface ResilientUploadOptions {
  /** Tamanho do arquivo em bytes (usado pra telemetria E pra calibração adaptativa). */
  fileSizeBytes?: number;
  /** Timeout por tentativa (ms). Quando omitido, é calculado a partir da rede + tamanho. */
  timeoutMs?: number;
  /** Número máx. de tentativas. Quando omitido, é calculado a partir da rede. */
  maxAttempts?: number;
  /** Backoff base (ms). Quando omitido, é calculado a partir da rede. */
  backoffBaseMs?: number;
  /** Callback opcional para feedback de UI (ex: toast). Recebe motivo no retry (timeout/network/5xx). */
  onAttempt?: (attempt: number, max: number, reason?: 'initial' | 'timeout' | 'network' | 'server') => void;
}

/** Lê hints da Network Information API (Chrome/Android). */
interface NetworkHints {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  downlinkMbps: number | null;
  saveData: boolean;
}

function readNetworkHints(): NetworkHints {
  if (typeof navigator === 'undefined') {
    return { effectiveType: 'unknown', downlinkMbps: null, saveData: false };
  }
  const conn = (navigator as any).connection;
  if (!conn) return { effectiveType: 'unknown', downlinkMbps: null, saveData: false };
  return {
    effectiveType: (conn.effectiveType as NetworkHints['effectiveType']) ?? 'unknown',
    downlinkMbps: typeof conn.downlink === 'number' ? conn.downlink : null,
    saveData: !!conn.saveData,
  };
}

/**
 * Calibra timeout/maxAttempts/backoff com base em:
 *   - effectiveType (slow-2g/2g/3g/4g)
 *   - downlinkMbps (quando disponível)
 *   - tamanho do arquivo (timeout proporcional)
 *
 * Retorna defaults razoáveis quando o browser não expõe Network Information.
 */
export function calibrateUploadProfile(
  fileSizeBytes: number | undefined,
  hints: NetworkHints = readNetworkHints()
): { timeoutMs: number; maxAttempts: number; backoffBaseMs: number } {
  const sizeMB = (fileSizeBytes ?? 0) / (1024 * 1024);

  // Bandwidth efetiva (Mbps) — usa downlink real se disponível, senão estima por effectiveType
  let bandwidthMbps: number;
  switch (hints.effectiveType) {
    case 'slow-2g': bandwidthMbps = 0.05; break;
    case '2g':      bandwidthMbps = 0.25; break;
    case '3g':      bandwidthMbps = 1.0;  break;
    case '4g':      bandwidthMbps = 5.0;  break;
    default:        bandwidthMbps = 4.0;  break; // assume 4G/Wi-Fi quando desconhecido
  }
  if (hints.downlinkMbps && hints.downlinkMbps > 0) {
    bandwidthMbps = Math.max(0.05, hints.downlinkMbps);
  }

  // Timeout = tempo estimado (s) × overhead (3×) + piso de 8s, teto de 90s
  // sizeMB×8 = megabits; /Mbps = segundos teóricos
  const estSeconds = sizeMB > 0 ? (sizeMB * 8) / bandwidthMbps : 8;
  const timeoutMs = Math.min(90_000, Math.max(8_000, Math.round(estSeconds * 3 * 1000)));

  // Tentativas: redes ruins merecem mais
  let maxAttempts = 3;
  if (hints.effectiveType === '3g' || hints.effectiveType === '2g') maxAttempts = 4;
  if (hints.effectiveType === 'slow-2g') maxAttempts = 5;
  if (hints.saveData) maxAttempts = Math.max(maxAttempts, 4);

  // Backoff base: começa mais alto em redes lentas (evita re-disparar antes da rede acordar)
  let backoffBaseMs = 800;
  if (hints.effectiveType === '3g') backoffBaseMs = 1_200;
  if (hints.effectiveType === '2g' || hints.effectiveType === 'slow-2g') backoffBaseMs = 2_000;

  return { timeoutMs, maxAttempts, backoffBaseMs };
}

export class UploadTimeoutError extends Error {
  constructor() {
    super('upload_timeout');
    this.name = 'UploadTimeoutError';
  }
}

const isRetryable = (err: unknown, status?: number): boolean => {
  if (err instanceof UploadTimeoutError) return true;
  if (status && status >= 500 && status < 600) return true;
  // TypeError ⇒ network failure no fetch
  if (err instanceof TypeError) return true;
  // AbortError já tratado como timeout
  return false;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Executa um POST de upload com retry/backoff. Espera URL, FormData e headers.
 * Retorna o JSON da resposta (lança em falha terminal).
 */
export async function resilientUpload<T = any>(
  url: string,
  body: FormData,
  headers: Record<string, string>,
  opts: ResilientUploadOptions = {}
): Promise<T> {
  const {
    timeoutMs = 25_000,
    maxAttempts = 3,
    backoffBaseMs = 800,
    onAttempt,
  } = opts;

  let lastError: unknown = null;
  const testActive = isUploadTestActive();
  const testScenario = getUploadTestMode().scenario;
  const startedAt = performance.now();
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attemptsUsed = attempt;
    onAttempt?.(attempt, maxAttempts);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // ── Test mode: latência + falha simulada ──
      if (testActive) {
        await applyTestLatency();
        const sim = shouldSimulateFailure();
        if (sim === 'timeout') {
          // Aborta artificialmente — vira UploadTimeoutError no catch
          controller.abort();
        } else if (sim === 'network') {
          clearTimeout(timer);
          throw new TypeError('test_mode_network_failure');
        }
      }

      const res = await fetch(url, {
        method: 'POST',
        body,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        // 4xx terminal — não tenta de novo
        if (res.status < 500) {
          let errMsg = `upload_failed_${res.status}`;
          try {
            const data = await res.json();
            errMsg = data?.error || errMsg;
          } catch {
            /* noop */
          }
          throw new Error(errMsg);
        }
        // 5xx → retry
        lastError = new Error(`upload_status_${res.status}`);
        if (!isRetryable(lastError, res.status) || attempt === maxAttempts) {
          throw lastError;
        }
      } else {
        const json = (await res.json()) as T;
        if (testActive) {
          recordUploadTestResult({
            scenario: testScenario,
            attempts: attemptsUsed,
            success: true,
            totalMs: performance.now() - startedAt,
            fileSizeBytes: opts.fileSizeBytes,
          });
        }
        return json;
      }
    } catch (err) {
      clearTimeout(timer);
      const isAbort = (err as any)?.name === 'AbortError';
      const normalized = isAbort ? new UploadTimeoutError() : err;
      lastError = normalized;

      if (!isRetryable(normalized) || attempt === maxAttempts) {
        if (testActive) {
          recordUploadTestResult({
            scenario: testScenario,
            attempts: attemptsUsed,
            success: false,
            totalMs: performance.now() - startedAt,
            fileSizeBytes: opts.fileSizeBytes,
            errorCode: (normalized as any)?.message || 'unknown',
          });
        }
        throw normalized;
      }
    }

    // Backoff com jitter
    const wait = backoffBaseMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
    await sleep(wait);
  }

  if (testActive) {
    recordUploadTestResult({
      scenario: testScenario,
      attempts: attemptsUsed,
      success: false,
      totalMs: performance.now() - startedAt,
      fileSizeBytes: opts.fileSizeBytes,
      errorCode: (lastError as any)?.message || 'exhausted',
    });
  }
  throw lastError ?? new Error('upload_failed');
}
