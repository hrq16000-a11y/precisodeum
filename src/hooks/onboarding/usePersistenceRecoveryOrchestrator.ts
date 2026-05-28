import { useEffect } from 'react';
import {
  readOnboardingV2Draft,
  readOnboardingV2DraftSavedAt,
  getLastReadDraftDiagnostics,
} from '@/components/onboarding/wizard/phases/v2/useOnboardingV2Draft';
import {
  trackOnboardingEvent,
  getOnboardingDraftSource,
  setOnboardingDraftSource,
} from '@/components/onboarding/wizard/phases/v2/telemetry';
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';
import type { OnboardingState } from '@/components/onboarding/wizard/phases/v2/types';

/**
 * E8 · Persistence / Recovery Orchestrator (Chain A · RECOV)
 *
 * ORDER CONTRACT
 *   REQUIRES:
 *     - Roda 1× por mount (deps `[skipDraftRestore]`, intencional).
 *     - Deve preceder E14 (bootstrap HYDRATE) — sem isso o bootstrap
 *       sobrescreveria draft local antes do hint chegar ao usuário.
 *     - Independe de E5 (flush por fase) e E11 (leader gate) — não
 *       consulta `isTabLeader()` nem grava em backend.
 *   PRODUCES:
 *     - `draftRestored` (banner local) via `setDraftRestored({source:'local'})`.
 *     - Telemetria: `recovery_local_used` (com refresh_detected/age_ms),
 *       `recovery_corrupted` (com reason), sticky source `seed|local|none`.
 *     - Timer auto-clear do hint (5s) registrado via `scheduleWizardTimeout`
 *       — atribuído à fase corrente p/ neutralização em troca de fase.
 *   CONSUMERS:
 *     - E14 lê `getOnboardingDraftSource()` para decidir bootstrap vs hint.
 *     - E16 também lê o sticky source em telemetria de phase enter.
 *     - UI: banner "rascunho restaurado" consome `draftRestored`.
 *   OWNERSHIP: este hook é o ÚNICO owner do hint LOCAL e do sticky source
 *             em RECOV (seed/local/none). Não duplicar em outros componentes.
 *   POSITION-DEPENDENCY: deve ser chamado ANTES de E14 no shell para que o
 *             bootstrap encontre o sticky source já definido.
 *
 * STALE-CLOSURE: lê `state.phase` via `getCurrentState()` no momento do
 * disparo — evita capturar fase obsoleta caso o effect rode após
 * dispatch tardio do bootstrap. Deps mantidas em `[skipDraftRestore]`
 * por design (1× por mount), idêntico ao comportamento pré-extração.
 *
 * PERSIST/RECOVERY SEMANTICS PRESERVADAS:
 *   - Sem write em backend (apenas leitura local).
 *   - Sem dependência de `isTabLeader()` (recovery client-side puro).
 *   - Sem duplicate persistence (não escreve em draft local nem remoto).
 *   - Cleanup determinístico do timer via `clearTimeout` no return.
 *   - Hardening F4 (refresh_detected) intacto: samePhase + TTL 6h.
 */
export interface UsePersistenceRecoveryOrchestratorParams {
  /** Read-path canônico (stateRef.current) — sem stale closure. */
  getCurrentState: () => OnboardingState;
  /** Flag de entrada via handoff (triagem/seed) — gate principal. */
  skipDraftRestore: boolean;
  /** Auth user id (telemetria). */
  userId: string | undefined;
  /** Setter local do banner de hint (owner permanece no shell). */
  setDraftRestored: (v: null | { source: 'local' | 'remote'; at?: string }) => void;
}

export function usePersistenceRecoveryOrchestrator({
  getCurrentState,
  skipDraftRestore,
  userId,
  setDraftRestored,
}: UsePersistenceRecoveryOrchestratorParams): void {
  useEffect(() => {
    if (skipDraftRestore) {
      // Handoff da triagem — marca sticky como "seed" (1× por sessão).
      if (!getOnboardingDraftSource()) setOnboardingDraftSource('seed');
      return;
    }
    const draft = readOnboardingV2Draft();
    if (draft && draft.phase && draft.phase !== 'phase2_service') {
      setDraftRestored({ source: 'local' });
      setOnboardingDraftSource('local');
      // Hardening F4 — `refresh_detected` SÓ se houver evidência real:
      //  - draft válido e na MESMA fase do estado atual (sem salto)
      //  - savedAt recente (< 6h) — exclui drafts dormentes do dia anterior
      //  - usuário já interagiu (envelope tem conteúdo significativo —
      //    readOnboardingV2Draft já garante isso via thin_content guard)
      const savedAt = readOnboardingV2DraftSavedAt() || 0;
      const REFRESH_TTL_MS = 6 * 60 * 60 * 1000;
      const currentPhase = getCurrentState().phase;
      const samePhase = String(draft.phase) === String(currentPhase);
      const isRecent = savedAt > 0 && Date.now() - savedAt < REFRESH_TTL_MS;
      const refreshDetected = samePhase && isRecent;
      void trackOnboardingEvent({
        phase: draft.phase as any,
        event: 'next',
        userId,
        meta: {
          kind: 'recovery_local_used',
          refresh_detected: refreshDetected,
          age_ms: savedAt ? Date.now() - savedAt : null,
        },
      });
      const t = scheduleWizardTimeout(
        { phase: currentPhase as any, action: 'shell_local_draft_hint_clear' },
        () => setDraftRestored(null),
        5000,
      );
      return () => clearTimeout(t);
    }
    // Sessão limpa: marca explicitamente como "none" para diferenciar de
    // sessões antigas onde a chave estava ausente. Se houve descarte por
    // checksum/shape/versão, emite telemetria com a razão para análise.
    if (!getOnboardingDraftSource()) setOnboardingDraftSource('none');
    const diag = getLastReadDraftDiagnostics();
    if (diag.reason && diag.reason !== 'empty' && diag.reason !== 'thin_content') {
      void trackOnboardingEvent({
        phase: getCurrentState().phase as any,
        event: 'error',
        userId,
        meta: { kind: 'recovery_corrupted', reason: diag.reason },
      });
    }
    // Deps intencionalmente `[skipDraftRestore]` — paridade total com a
    // versão pré-extração (roda 1× por mount). `getCurrentState` é
    // referencialmente estável (useCallback) e não deve disparar rebind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipDraftRestore]);
}
