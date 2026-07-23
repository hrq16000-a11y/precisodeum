/**
 * crossTabDebug — logger dev-only para diagnóstico do heartbeat/leader
 * election entre abas do wizard de cadastro.
 *
 * - Em DEV/TEST: emite `console.debug` prefixado com escopo, sem PII.
 * - Em produção: no-op absoluto (funções vazias, sem custo em runtime).
 *
 * Uso:
 *   ctDebug('leader', 'claim', { tabId, reason });
 *   ctDebug('heartbeat', 'write', { tabId });
 *
 * NUNCA logar dados sensíveis (email, tax_id, tokens). Apenas metadados
 * técnicos de coordenação (tabId, timestamps, motivos de transição).
 */

const isDev = ((): boolean => {
  try {
    return Boolean(
      typeof import.meta !== 'undefined' &&
        ((import.meta as any).env?.DEV || (import.meta as any).env?.MODE === 'test'),
    );
  } catch {
    return false;
  }
})();

export type CrossTabScope = 'leader' | 'heartbeat' | 'concurrent' | 'page';

export function ctDebug(scope: CrossTabScope, event: string, data?: Record<string, unknown>): void {
  if (!isDev) return;
  try {
    // eslint-disable-next-line no-console
    console.debug(`[cross-tab:${scope}] ${event}`, data ?? {});
  } catch {
    /* fail-soft */
  }
}

export const IS_CROSS_TAB_DEBUG_ENABLED = isDev;
