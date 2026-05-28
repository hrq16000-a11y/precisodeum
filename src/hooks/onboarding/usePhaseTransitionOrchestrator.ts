import { useEffect } from 'react';
import { flushOnboardingV2Draft } from '@/components/onboarding/wizard/phases/v2/flushDraft';
import type { OnboardingState, OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';

/**
 * E5 · Phase Transition Orchestrator (Chain B step 3)
 *
 * ORDER CONTRACT
 *   REQUIRES: E17 (signalLifecyclePhase + setActiveWizardPhase) já executou
 *             para a nova fase — timers ficam atribuídos à fase correta.
 *             Posicional no shell: este hook é chamado APÓS E17 e ANTES
 *             de E18 (submit). Reordenar viola sequencing da Chain B.
 *   PRODUCES: write local + remoto (fire-and-forget) sincronizado por fase.
 *   CONSUMERS: nenhum effect downstream — apenas backend (drafts) e
 *             futuros consumidores de `onboarding_v2_drafts`.
 *   GATE: isTabLeader() é consultado dentro de flushOnboardingV2Draft
 *         (não cabe ao hook).
 *   POSITION-DEPENDENCY: a chamada ao hook deve permanecer no mesmo
 *         ponto do shell (após E17, antes de E18). Internamente o hook
 *         registra UM effect — sem rebinding por mudança de `state`.
 *
 * STALE-CLOSURE: lê snapshot do estado via `getCurrentState()` no momento
 * do flush. NÃO depende de closure capturada do React render.
 *
 * BLINDAGEM: pula flush em editMode (evita overwrite remoto parcial) e
 * em fases não persistíveis (`phase2_service`, `done`).
 */
export interface UsePhaseTransitionOrchestratorParams {
  /** Read-path canônico (stateRef.current). */
  getCurrentState: () => OnboardingState;
  /** Fase atual — única dep que dispara o flush. */
  phase: OnboardingPhase;
  /** Auth user id para flush remoto. */
  userId: string | undefined;
  /** Modo revisão (Assistente) — desliga flush por fase. */
  editMode: boolean;
}

export function usePhaseTransitionOrchestrator({
  getCurrentState,
  phase,
  userId,
  editMode,
}: UsePhaseTransitionOrchestratorParams): void {
  useEffect(() => {
    if (editMode) return;
    if (phase === 'phase2_service' || phase === 'done') return;
    // Snapshot atômico — sem stale closure de `state`.
    flushOnboardingV2Draft(getCurrentState(), userId);
    // Deps mínimas e estáveis: dispara APENAS quando phase/userId/editMode
    // mudam. getCurrentState é referencialmente estável (useCallback no shell).
  }, [phase, userId, editMode, getCurrentState]);
}
