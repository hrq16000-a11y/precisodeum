/**
 * diagnostics — logger dev-only que conta e correlaciona chamadas Supabase
 * por (origem, phase, userId) durante o onboarding V2.
 *
 * Objetivo: confirmar visualmente, durante DEV/TEST, que cada transição
 * de fase produz exatamente UMA escrita remota — sem o flush imediato +
 * autosave debounced colidirem (regressão recorrente do fluxo PJ).
 *
 * Em produção, todas as funções viram no-op para custo zero.
 *
 * Uso:
 *   recordWizardSupabaseCall('flushRemoteDraft', 'phase2_service', userId);
 *   recordWizardSupabaseCall('useRemoteDraft.debounced', 'phase2_service', userId);
 *   getWizardSupabaseSummary(); // → array com counts por chave
 *   resetWizardSupabaseDiagnostics();
 */

export type WizardSupabaseSource =
  | 'flushRemoteDraft'
  | 'useRemoteDraft.debounced'
  | 'persistPatch';

export interface WizardSupabaseCallEntry {
  source: WizardSupabaseSource;
  phase: string;
  userId: string;
  ts: number;
}

const ENABLED =
  typeof import.meta !== 'undefined' &&
  ((import.meta as any).env?.DEV || (import.meta as any).env?.MODE === 'test');

const calls: WizardSupabaseCallEntry[] = [];
const MAX_ENTRIES = 200;

export function recordWizardSupabaseCall(
  source: WizardSupabaseSource,
  phase: string | null | undefined,
  userId: string | null | undefined,
): void {
  if (!ENABLED) return;
  try {
    calls.push({
      source,
      phase: String(phase ?? 'unknown'),
      userId: userId || 'anon',
      ts: Date.now(),
    });
    if (calls.length > MAX_ENTRIES) calls.shift();
  } catch { /* fail-soft */ }
}

/**
 * Resumo agregado por (source, phase). Útil em testes para asserir
 * que `flushRemoteDraft` foi chamado exatamente 1x por phase e que o
 * debounced foi pulado quando o flush imediato ocorreu antes.
 */
export function getWizardSupabaseSummary(): Array<{
  key: string;
  source: WizardSupabaseSource;
  phase: string;
  count: number;
  lastAt: number;
}> {
  const map = new Map<string, { source: WizardSupabaseSource; phase: string; count: number; lastAt: number }>();
  for (const c of calls) {
    const key = `${c.source}@${c.phase}`;
    const cur = map.get(key);
    if (cur) {
      cur.count += 1;
      cur.lastAt = Math.max(cur.lastAt, c.ts);
    } else {
      map.set(key, { source: c.source, phase: c.phase, count: 1, lastAt: c.ts });
    }
  }
  return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
}

export function getWizardSupabaseCalls(): readonly WizardSupabaseCallEntry[] {
  return calls;
}

export function resetWizardSupabaseDiagnostics(): void {
  calls.length = 0;
}
