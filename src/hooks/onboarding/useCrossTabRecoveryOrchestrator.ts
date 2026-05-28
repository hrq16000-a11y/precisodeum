import { useEffect } from 'react';
import {
  readOnboardingV2Draft,
  readOnboardingV2DraftSavedAt,
} from '@/components/onboarding/wizard/phases/v2/useOnboardingV2Draft';
import { fetchRemoteDraft } from '@/components/onboarding/wizard/phases/v2/useOnboardingV2RemoteDraft';
import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';
import { neutralizeZombieTimers } from '@/lib/wizardZombieGuard';
import { phaseIndex } from '@/components/onboarding/wizard/phases/v2/state';

export interface RemoteDraftPayload {
  payload: {
    profile: any;
    service: any;
    userRef?: string | null;
    providerId?: string | null;
    firstServiceId?: string | null;
  };
  phase: any;
  updated_at: string;
}

export interface UseCrossTabRecoveryOrchestratorParams {
  userId: string | undefined;
  skipDraftRestore: boolean;
  /** Fase atual (apenas para telemetria de `recovery_remote_discarded`). */
  currentPhase: string;
  /** Owner do state remoto permanece no shell (consumido pelo modal). */
  setRemoteDraft: (v: RemoteDraftPayload | null) => void;
  setShowRemoteModal: (v: boolean) => void;
}

/**
 * CROSS-TAB RECOVERY ORCHESTRATOR (E9)
 *
 * REQUIRES:
 *  - mount-once (deps = [userId, skipDraftRestore], idêntico ao pré-extração)
 *  - E8 (persistence recovery) já inicializado — sticky source `seed|local|none`
 *    deve estar resolvido para que a decisão "abrir modal vs ignorar remoto"
 *    use o read local consistente.
 *  - crossTabSync runtime disponível (heartbeat/leader via E11).
 *
 * PRODUCES:
 *  - session coordination: chama `neutralizeZombieTimers` p/ consumir flags
 *    remanescentes da triagem (bet_shell_finalized) sem disparar writes.
 *  - remote recovery synchronization: lê draft remoto via `fetchRemoteDraft`
 *    e, quando elegível, expõe via `setRemoteDraft`/`setShowRemoteModal`
 *    para o shell renderizar o modal de decisão (handlers permanecem no shell).
 *  - draft ownership negotiation bootstrap: compara timestamps local x remoto
 *    com folga de 5s para descartar remoto obsoleto e telemetra
 *    `recovery_remote_discarded` com motivo `local_newer`.
 *
 * CONSUMERS:
 *  - E11 write-gates (continua autoridade isolada de write — nenhuma alteração).
 *  - E14 hydration bootstrap (este hook NÃO dispatcha HYDRATE; apenas sinaliza
 *    o modal — o handler do shell é quem dispatcha após decisão do usuário).
 *  - E19 back orchestration (sem coupling direto — apenas via UI/state).
 *
 * OWNERSHIP:
 *  - único owner do bootstrap de detecção cross-tab/remote-draft no shell V2.
 *
 * POSITION-DEPENDENCY:
 *  - deve executar ANTES do hydration core (E14/E15) para garantir que, se o
 *    usuário escolher "continuar remoto", o HYDRATE do handler vença a corrida
 *    contra o bootstrap (que é gated por `pendingCoreFields`/seed).
 *
 * RACE-BOUNDARY:
 *  - NUNCA emite write (sem persistPhase*, sem clearRemoteDraft aqui).
 *  - NUNCA chama finalize / finalize_onboarding_atomic.
 *  - NUNCA dispatcha HYDRATE — handler do shell é o único caminho.
 *  - NUNCA toca `isTabLeader()` — write-gate continua autoridade isolada.
 */
export function useCrossTabRecoveryOrchestrator({
  userId,
  skipDraftRestore,
  currentPhase,
  setRemoteDraft,
  setShowRemoteModal,
}: UseCrossTabRecoveryOrchestratorParams): void {
  useEffect(() => {
    if (!userId) return;
    if (skipDraftRestore) return;
    // Anti-zumbi: neutraliza qualquer timer remanescente do BetModeShell e
    // consome a flag de finalização da triagem (se presente). Se ausente,
    // significa entrada direta no Step 8+ sem passar pela triagem — prossegue
    // normalmente.
    try { neutralizeZombieTimers(); } catch { /* noop */ }
    try { if (typeof window !== 'undefined') sessionStorage.removeItem('bet_shell_finalized'); } catch { /* noop */ }
    const local = readOnboardingV2Draft();
    const localPhase = (local?.phase as any) || 'phase2_service';
    let alive = true;
    (async () => {
      const remote = await fetchRemoteDraft(userId);
      if (!alive || !remote) return;
      // Containment patch — Crítico #4: NÃO sobrescrever estado mais novo.
      // Se o draft LOCAL foi salvo depois do remoto (>5s de folga p/ relógios
      // dessincronizados), o usuário tem dados frescos que ainda não subiram
      // ao banco — ignorar o remoto evita reverter o estado dele.
      const localSavedAt = readOnboardingV2DraftSavedAt() || 0;
      const remoteSavedAt = remote.updated_at ? Date.parse(remote.updated_at) : 0;
      if (localSavedAt > 0 && remoteSavedAt > 0 && localSavedAt > remoteSavedAt + 5000) {
        void trackOnboardingEvent({
          phase: currentPhase as any,
          event: 'next',
          userId,
          meta: {
            kind: 'recovery_remote_discarded',
            reason: 'local_newer',
            local_saved_at: localSavedAt,
            remote_updated_at: remoteSavedAt,
            delta_ms: localSavedAt - remoteSavedAt,
          },
        });
        return;
      }
      const remotePhase = remote.phase as any;
      const remoteIdx = phaseIndex(remotePhase);
      const localIdx = phaseIndex(localPhase);
      const remoteIsAhead = remoteIdx > localIdx;
      const localIsEmpty = !local || localPhase === 'phase2_service';
      // Pergunta sempre que (a) local vazio, ou (b) remoto está mais à frente.
      if (!localIsEmpty && !remoteIsAhead) return;
      setRemoteDraft(remote as RemoteDraftPayload);
      setShowRemoteModal(true);
    })();
    return () => { alive = false; };
    // Deps intencionalmente `[userId, skipDraftRestore]` — paridade total
    // com o effect pré-extração no shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, skipDraftRestore]);
}
