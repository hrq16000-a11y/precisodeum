/**
 * useRemoteDraftHintTimer — owner ÚNICO do timer que limpa o hint
 * "rascunho restaurado (remoto)" após 6s.
 *
 * PR 17 — Shell Surface Slimming. Extração 1:1 do effect E-REMOTE-HINT
 * do `OnboardingV2Shell`:
 *   - REQUIRES: caller setou `draftRestored.source = 'remote'`.
 *   - PRODUCES: `clearDraftRestored()` após 6s (via setter recebido).
 *   - OWNERSHIP: este hook é o ÚNICO owner do timer. Cleanup no unmount
 *     garante zero zombie (gate `wizardZombieGuard`).
 *   - STALE-CLOSURE: usa `getCurrentPhase()` (getter ref-based) para
 *     `phase_at_schedule` — NÃO captura `state.phase` via closure.
 *
 * Não dispara dispatch, não escreve em storage, não toca o reducer.
 */
import { useEffect, useRef } from 'react';
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';

interface RemoteDraftHintTimerInput {
  /** Origem do draft restaurado — só agenda timer quando === 'remote'. */
  readonly source: 'local' | 'remote' | undefined | null;
  /** ISO timestamp do restore — força reschedule se mudar. */
  readonly at?: string;
  /** Snapshot da fase ATUAL no momento do agendamento (sem closure). */
  readonly getCurrentPhase: () => string;
  /** Callback que zera o hint na UI. */
  readonly clearDraftRestored: () => void;
}

const HINT_DURATION_MS = 6000;

export function useRemoteDraftHintTimer({
  source,
  at,
  getCurrentPhase,
  clearDraftRestored,
}: RemoteDraftHintTimerInput): void {
  // Ref defensiva de cleanup no unmount (idêntica ao shell pré-PR17).
  const handleRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (handleRef.current != null && typeof window !== 'undefined') {
        window.clearTimeout(handleRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (source !== 'remote') return;
    const phaseAtSchedule = getCurrentPhase();
    const handle = scheduleWizardTimeout(
      { phase: phaseAtSchedule as any, action: 'shell_remote_draft_hint_clear' },
      () => clearDraftRestored(),
      HINT_DURATION_MS,
    );
    handleRef.current = handle;
    return () => {
      if (typeof window !== 'undefined') window.clearTimeout(handle);
      if (handleRef.current === handle) handleRef.current = null;
    };
  }, [source, at, getCurrentPhase, clearDraftRestored]);
}

export default useRemoteDraftHintTimer;
