/**
 * invokeWithGuard — wrapper resiliente para supabase.functions.invoke.
 *
 * Pilares:
 *  1. Timeout real via AbortController (default 20s) → erro 'TIMEOUT' em vez de spinner infinito.
 *  2. Idempotência automática: gera UUID e injeta em header `x-idempotency-key`
 *     e no body (`_idempotency_key`) — o servidor pode dedupar repetições acidentais.
 *  3. Retry inteligente: 1 tentativa extra apenas para erros de rede / 5xx transitórios
 *     (502, 503, 504, fetch error, timeout). Nunca retenta 4xx (validação/permissão).
 *
 * Uso:
 *   const { data, error, timedOut } = await invokeWithGuard('admin-create-user', { body: {...} });
 *   if (timedOut) toast.error('Ação enviada, mas a resposta demorou. Verifique a lista.');
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Perfil de timeout adaptativo:
 *  - 'admin'      → 20s. Operações de back-office; rede tipicamente boa.
 *  - 'user'       → 35s. Conexões móveis 3G instáveis (interior do Brasil),
 *                   exclusão de conta, uploads de usuário final.
 *  - 'background' → 45s. Cron-like, sem UI travando.
 */
export type InvokeTimeoutProfile = 'admin' | 'user' | 'background';

export interface InvokeGuardOptions {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** Timeout explícito em ms. Sobrescreve `timeoutProfile`. */
  timeoutMs?: number;
  /** Perfil adaptativo (default 'admin' = 20s). */
  timeoutProfile?: InvokeTimeoutProfile;
  /** Quando true (default), gera idempotencyKey e injeta. */
  idempotent?: boolean;
  /** Quando true (default), tenta 1 retry em erros transitórios. */
  retry?: boolean;
}

export interface InvokeGuardResult<T = unknown> {
  data: T | null;
  error: Error | null;
  /** True se a chamada foi abortada por timeout (a operação pode ter chegado no servidor). */
  timedOut: boolean;
  /** Chave idempotente usada (útil para logs / suporte). */
  idempotencyKey: string | null;
  /** Quantas tentativas foram feitas (1 ou 2). */
  attempts: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;

const TIMEOUT_PROFILE_MS: Record<InvokeTimeoutProfile, number> = {
  admin: 20_000,
  user: 35_000,
  background: 45_000,
};

function resolveTimeout(opts: { timeoutMs?: number; timeoutProfile?: InvokeTimeoutProfile }): number {
  if (typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0) return opts.timeoutMs;
  if (opts.timeoutProfile) return TIMEOUT_PROFILE_MS[opts.timeoutProfile];
  return DEFAULT_TIMEOUT_MS;
}

function genUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* noop */ }
  // Fallback RFC4122-ish
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Classifica se um erro é transitório (vale retry) ou definitivo.
 * - Timeout / abort                  → transitório
 * - TypeError fetch / network        → transitório
 * - HTTP 502 / 503 / 504             → transitório
 * - HTTP 4xx (400, 401, 403, 404…)   → definitivo
 * - Erro de validação no payload     → definitivo
 */
function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: string; message?: string; status?: number; context?: { status?: number } };
  if (e.name === 'AbortError' || e.name === 'TimeoutError') return true;
  const status = e.status ?? e.context?.status;
  if (typeof status === 'number') {
    if (status >= 500 && status <= 599) return true;
    return false; // 4xx jamais retenta
  }
  const msg = (e.message || '').toLowerCase();
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnreset')
  ) {
    return true;
  }
  return false;
}

async function invokeOnce<T>(
  fnName: string,
  body: Record<string, unknown> | undefined,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ data: T | null; error: Error | null; timedOut: boolean }> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timer = controller
    ? setTimeout(() => {
        timedOut = true;
        try { controller.abort(); } catch { /* noop */ }
      }, timeoutMs)
    : null;

  try {
    const res = await supabase.functions.invoke(fnName, {
      body,
      headers,
    });
    if (res.error) {
      return { data: null, error: res.error as Error, timedOut: false };
    }
    return { data: (res.data ?? null) as T | null, error: null, timedOut: false };
  } catch (err) {
    if (timedOut) {
      const e = new Error(`TIMEOUT: ${fnName} did not respond within ${timeoutMs}ms`);
      (e as Error & { name: string }).name = 'TimeoutError';
      return { data: null, error: e, timedOut: true };
    }
    return { data: null, error: err as Error, timedOut: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Wrapper principal. Veja JSDoc no topo do arquivo.
 */
export async function invokeWithGuard<T = unknown>(
  fnName: string,
  opts: InvokeGuardOptions = {},
): Promise<InvokeGuardResult<T>> {
  const {
    body,
    headers: extraHeaders = {},
    idempotent = true,
    retry = true,
  } = opts;
  const timeoutMs = resolveTimeout(opts);

  const idempotencyKey = idempotent ? genUuid() : null;
  const headers: Record<string, string> = { ...extraHeaders };
  let outBody: Record<string, unknown> | undefined = body;

  if (idempotencyKey) {
    headers['x-idempotency-key'] = idempotencyKey;
    outBody = { ...(body ?? {}), _idempotency_key: idempotencyKey };
  }

  // Tentativa 1
  let attempts = 1;
  let result = await invokeOnce<T>(fnName, outBody, headers, timeoutMs);

  // Retry apenas para erros transitórios
  if (result.error && retry && isTransientError(result.error)) {
    attempts = 2;
    // Pequeno backoff (300ms) — evita martelar serviço degradado
    await new Promise((r) => setTimeout(r, 300));
    result = await invokeOnce<T>(fnName, outBody, headers, timeoutMs);
  }

  return {
    data: result.data,
    error: result.error,
    timedOut: result.timedOut,
    idempotencyKey,
    attempts,
  };
}

/**
 * Mensagem padrão de UX para timeout / falha persistente.
 * Use com `toast.error(EDGE_GUARD_FALLBACK_MESSAGE)`.
 */
export const EDGE_GUARD_FALLBACK_MESSAGE =
  'Ação enviada, mas a resposta demorou. Verifique a lista em instantes antes de tentar novamente.';
