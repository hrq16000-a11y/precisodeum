import { useEffect } from 'react';
import { registerBackOwner, claimBackEvent } from '@/lib/wizardBackOrchestrator';
import {
  popReviewPhase,
} from '@/components/onboarding/wizard/phases/v2/reviewHistory';
import { flushLocalDraft } from '@/components/onboarding/wizard/phases/v2/flushDraft';
import type { OnboardingState } from '@/components/onboarding/wizard/phases/v2/types';
import type { OnboardingAction } from '@/components/onboarding/wizard/phases/v2/state';

/**
 * E19 · Back Navigation Orchestrator (Chain C)
 *
 * ORDER CONTRACT
 *   REQUIRES: read-path canônico via `getCurrentState()` (stateRef no shell).
 *             NÃO depende de closure de `state` — deps são estáveis e o
 *             listener registra UMA VEZ por sessão de hook.
 *   PRODUCES: flushLocalDraft + flushRemoteDraft (opcional) + dispatch GO_TO
 *             ou CustomEvent('wizard:request-prev-unified').
 *   CONSUMERS: Chain B (PHASE) reentra após dispatch GO_TO.
 *   OWNERSHIP: registerBackOwner('v2') é o owner canônico do evento
 *              'wizard:request-back'. claimBackEvent('v2') aplica mutex
 *              global de 400ms (anti double-tap + handoff Bet→V2).
 *   POSITION-DEPENDENCY: nenhuma. Hook é auto-contido; ordem de declaração
 *              no shell é irrelevante desde que `getCurrentState` e
 *              `dispatch` sejam estáveis (referencialmente).
 *
 * BLAST RADIUS: limitado a Chain C; não toca hydration (Chain A) nem
 * leader election (Chain D) nem submit (E18).
 */
export interface UseBackNavigationOrchestratorParams {
  /** Read-path canônico (stateRef.current) — evita stale closure. */
  getCurrentState: () => OnboardingState;
  /** Modo de revisão (Assistente). */
  editMode: boolean;
  /** Auth user id para flush remoto. */
  userId: string | undefined;
  /** Dispatch do reducer V2 (referencialmente estável via useReducer). */
  dispatch: (action: OnboardingAction) => void;
}

export function useBackNavigationOrchestrator({
  getCurrentState,
  editMode,
  userId,
  dispatch,
}: UseBackNavigationOrchestratorParams): void {
  useEffect(() => {
    const goBack = async () => {
      // ── ANTI-AMNÉSIA: persiste snapshot atual (local + remoto) ANTES
      // do dispatch GO_TO. Qualquer dado ainda no debounce do auto-save
      // não pode se perder quando a fase desmontar.
      const snapshot = getCurrentState();
      try {
        flushLocalDraft(snapshot);
        if (!editMode) {
          // Em editMode evitamos overwrite remoto parcial (mesma
          // blindagem já aplicada no auto-save). Local é seguro.
          const { flushRemoteDraft } = await import(
            '@/components/onboarding/wizard/phases/v2/flushDraft'
          );
          await flushRemoteDraft(snapshot, userId).catch(() => {
            /* fail-soft */
          });
        }
      } catch {
        /* fail-soft */
      }

      // Re-leitura da fase APÓS o flush async — flushRemoteDraft pode ter
      // levado alguns ms; a fase atual é a fonte de verdade no momento do
      // dispatch, não a do início do handler.
      const currentPhase = getCurrentState().phase;

      // ── MODO REVISÃO: navegação não-linear (Assistente é dono do Wizard).
      if (editMode) {
        const previous = popReviewPhase();
        if (previous && previous !== currentPhase) {
          dispatch({ type: 'GO_TO', phase: previous as any });
          return;
        }
        // Pilha esgotada — WizardShell retrocede na régua unificada.
        try {
          window.dispatchEvent(
            new CustomEvent('wizard:request-prev-unified', {
              detail: { fromV2Phase: currentPhase },
            }),
          );
        } catch {
          /* fail-soft */
        }
        return;
      }

      // ── FLUXO NORMAL (new_signup): mapa estático de antecessores.
      switch (currentPhase) {
        // phase1_* removidas em mai/2026; phase2_service é a 1ª fase viva.
        // Voltar de phase2_service é responsabilidade do WizardShell
        // (sai para triage_celebration).
        case 'phase2_service':
          /* noop — WizardShell trata o retorno à triagem */
          break;
        case 'phase2_details':
          dispatch({ type: 'GO_TO', phase: 'phase2_service' });
          break;
        case 'phase2_photos':
          dispatch({ type: 'GO_TO', phase: 'phase2_details' });
          break;
        case 'phase3_celebration':
          dispatch({ type: 'GO_TO', phase: 'phase2_photos' });
          break;
        case 'phase4_document':
          dispatch({ type: 'GO_TO', phase: 'phase3_celebration' });
          break;
        case 'phase4_avatar':
          dispatch({ type: 'GO_TO', phase: 'phase4_document' });
          break;
        case 'phase4_extras_a':
          dispatch({ type: 'GO_TO', phase: 'phase4_avatar' });
          break;
        case 'phase4_extras_b':
          dispatch({ type: 'GO_TO', phase: 'phase4_extras_a' });
          break;
      }
    };

    // V2 tem prioridade sobre Bet — quando ambos registrados (handoff),
    // apenas o V2 processa o evento.
    const releaseOwner = registerBackOwner('v2');
    const handler = (e: Event) => {
      // Mutex global: ignora se outro listener já consumiu ou se ainda
      // estamos no cooldown anti-double-tap (400ms).
      if (!claimBackEvent('v2', e)) return;
      void goBack();
    };
    window.addEventListener('wizard:request-back', handler as EventListener);
    return () => {
      window.removeEventListener('wizard:request-back', handler as EventListener);
      releaseOwner();
    };
    // Deps estáveis: getCurrentState e dispatch são referencialmente
    // constantes (useCallback / useReducer). Listener registra UMA vez
    // por (editMode, userId) — sem rebinding por mudança de `state`.
  }, [getCurrentState, editMode, userId, dispatch]);
}
