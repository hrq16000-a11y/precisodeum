/**
 * FASE A · Wrapper único para os RPCs de tracking.
 *
 * Motivação: em ago/2026 os três RPCs de tracking (`track_sponsor_metric`,
 * `log_search_intent`, `record_public_funnel_event`) ficaram semanas quebrados
 * com `42501 permission denied` sem que ninguém percebesse, porque todas as
 * chamadas eram fire-and-forget com catch vazio.
 *
 * Este wrapper:
 *  - nunca lança nem bloqueia a UI;
 *  - mede latência e captura o código de erro do Postgres;
 *  - reporta ao servidor com AMOSTRAGEM (100% dos erros, 5% dos sucessos)
 *    via `record_tracking_rpc_health`, alimentando /admin/tracking-health.
 */

import { supabase } from '@/integrations/supabase/client';

export type TrackedRpcName =
  | 'track_sponsor_metric'
  | 'log_search_intent'
  | 'record_public_funnel_event';

export const SUCCESS_SAMPLE_RATE = 0.05;
export const ERROR_SAMPLE_RATE = 1;

export interface RpcOutcome {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  latencyMs: number;
}

/** Decide se este resultado entra na amostra reportada. */
export function shouldSample(ok: boolean, random: number = Math.random()): boolean {
  return ok ? random < SUCCESS_SAMPLE_RATE : random < ERROR_SAMPLE_RATE;
}

function currentPath(): string {
  try {
    return window.location.pathname;
  } catch {
    return '/';
  }
}

function reportHealth(rpc: TrackedRpcName, outcome: RpcOutcome): void {
  if (!shouldSample(outcome.ok)) return;
  try {
    void (supabase.rpc as any)('record_tracking_rpc_health', {
      _rpc_name: rpc,
      _outcome: outcome.ok ? 'success' : 'error',
      _error_code: outcome.errorCode ?? null,
      _error_message: outcome.errorMessage ?? null,
      _latency_ms: Math.round(outcome.latencyMs),
      _pathname: currentPath(),
    }).then(
      () => {},
      () => {},
    );
  } catch {
    // observabilidade nunca pode quebrar a página
  }
}

/**
 * Executa um RPC de tracking de forma segura e observável.
 * Sempre resolve — nunca rejeita.
 */
export async function trackingRpc(
  rpc: TrackedRpcName,
  args: Record<string, unknown>,
): Promise<RpcOutcome> {
  const started =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  let outcome: RpcOutcome;
  try {
    const { error } = await (supabase.rpc as any)(rpc, args);
    const latencyMs =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;

    if (error) {
      outcome = {
        ok: false,
        errorCode: (error as any)?.code ?? 'unknown',
        errorMessage: String((error as any)?.message ?? '').slice(0, 300),
        latencyMs,
      };
      if (outcome.errorCode === '42501') {
        console.error(`[tracking] permission denied em ${rpc}`, error);
      } else {
        console.warn(`[tracking] falha em ${rpc}`, error);
      }
    } else {
      outcome = { ok: true, latencyMs };
    }
  } catch (err) {
    const latencyMs =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
    outcome = {
      ok: false,
      errorCode: 'network',
      errorMessage: String((err as Error)?.message ?? err).slice(0, 300),
      latencyMs,
    };
  }

  reportHealth(rpc, outcome);
  return outcome;
}
