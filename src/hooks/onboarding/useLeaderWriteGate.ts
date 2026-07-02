import { useEffect, useState } from 'react';
import {
  detectConcurrentTab,
  startTabHeartbeat,
  startTabLeaderElection,
  isTabLeader,
} from '@/components/onboarding/wizard/phases/v2/crossTabSync';
import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';
import type { OnboardingState } from '@/components/onboarding/wizard/phases/v2/types';

/**
 * E11 · Leader / Write Gating Orchestrator (Chain D · cross-tab)
 *
 * ORDER CONTRACT
 *   REQUIRES: roda 1× por mount (deps vazias) — independente de
 *             `state.phase` ou `userId`. Heartbeat e leader election
 *             precisam viver durante TODO o ciclo do shell.
 *   PRODUCES:
 *     - heartbeat de aba ativa (storage key local)
 *     - eleição de líder (write-guard global consumido por
 *       `flushOnboardingV2Draft` e `persist*` via `isTabLeader()`)
 *     - telemetria one-shot `error/concurrent_tab_detected`
 *   CONSUMERS:
 *     - `flushOnboardingV2Draft`, `flushRemoteDraft`, `persistPhase1`
 *       e qualquer write que consulte `isTabLeader()` antes de gravar.
 *   OWNERSHIP: este hook é o ÚNICO owner de heartbeat/leader no shell V2.
 *             Não duplicar em outros componentes do wizard.
 *   POSITION-DEPENDENCY: nenhuma. Pode ser chamado em qualquer ordem
 *             dentro do shell — não compete com hydration/recovery.
 *
 * STALE-CLOSURE: usa `getCurrentState()` para a fase no momento do
 * disparo de telemetria — evita capturar uma fase obsoleta caso o
 * detector rode tardiamente.
 *
 * CROSS-TAB SEMANTICS PRESERVADAS:
 *   - leader exclusivity (apenas 1 líder por user)
 *   - write exclusivity (não-líderes ficam mudos no flush)
 *   - cooldown / handoff semantics (delegados a `crossTabSync`)
 *   - polling 5s mantido para detectar handoff quando líder anterior cai
 */
export interface UseLeaderWriteGateParams {
  /** Read-path canônico (stateRef.current). */
  getCurrentState: () => OnboardingState;
  /** Auth user id (para telemetria). */
  userId: string | undefined;
}

export function useLeaderWriteGate({
  getCurrentState,
  userId,
}: UseLeaderWriteGateParams): { isLeader: boolean } {
  // Heartbeat + leader election + detector de concorrência — UMA vez por
  // mount. Não rebinda em mudança de state/phase/userId.
  useEffect(() => {
    const stopHeartbeat = startTabHeartbeat();
    const stopLeader = startTabLeaderElection();
    if (detectConcurrentTab()) {
      void trackOnboardingEvent({
        phase: getCurrentState().phase as any,
        event: 'error',
        userId,
        meta: { kind: 'concurrent_tab_detected' },
      });
    }
    return () => {
      stopHeartbeat();
      stopLeader();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling 5s para detectar troca de liderança (handoff quando líder
  // anterior fecha). Mantido para paridade comportamental — consumidores
  // externos (ex.: banner em CadastroInicialPage) podem ler via retorno.
  const [isLeader, setIsLeader] = useState<boolean>(() => isTabLeader());
  useEffect(() => {
    const id = setInterval(() => setIsLeader(isTabLeader()), 5000);
    return () => clearInterval(id);
  }, []);

  return { isLeader };
}
