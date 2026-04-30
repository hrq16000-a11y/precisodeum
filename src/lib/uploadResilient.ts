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
  /** Tamanho do arquivo em bytes (opcional, usado só pra telemetria de teste). */
  fileSizeBytes?: number;
  /** Timeout por tentativa (ms). Default 25s — 3G real demora pra subir 300KB. */
  timeoutMs?: number;
  /** Número máx. de tentativas (incluindo a primeira). Default 3. */
  maxAttempts?: number;
  /** Backoff base (ms). Tentativa N espera base * 2^(N-1) + jitter. Default 800. */
  backoffBaseMs?: number;
  /** Callback opcional para feedback de UI (ex: toast). */
  onAttempt?: (attempt: number, max: number) => void;
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
