import { useEffect } from 'react';
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';
import { clearOnboardingV2Draft } from '@/components/onboarding/wizard/phases/v2/useOnboardingV2Draft';

type LifecyclePhase =
  | 'BOOT'
  | 'HYDRATING'
  | 'HYDRATED'
  | 'READY'
  | 'SUBMITTING'
  | 'COMPLETED';

export interface UseSubmitCoreOrchestratorOptions {
  /** Fase atual do reducer V2 — único trigger legítimo é `'done'`. */
  phase: string;
  /** Quando true, parent assume controle e o orchestrator é no-op. */
  deferCompletionToParent: boolean;
  /** Único emissor de 'SUBMITTING'/'COMPLETED' do shell V2. */
  signalLifecyclePhase: (next: LifecyclePhase) => void;
  /**
   * Função terminal do shell. Retorna Promise; resolve mesmo quando
   * `finalizeOnboarding` falha (nesse caso NÃO navega e mantém a
   * lifecycle em 'SUBMITTING' para permitir retry via toast).
   */
  finishWizard: () => Promise<void>;
}

/**
 * E18 · Submit Core Orchestrator (Chain B step 5 · SUBMIT terminal)
 *
 * ORDER CONTRACT (preservado byte-a-byte do shell original)
 *   REQUIRES:
 *     - state.phase === 'done' (único trigger automático)
 *     - !deferCompletionToParent (parent pode assumir o controle)
 *     - lifecycle ≥ READY (garantido por hydration core já concluído)
 *   PRODUCES (SUBMIT-SEQUENCE):
 *     1. signalLifecyclePhase('SUBMITTING')   ← síncrono, gate visual
 *     2. clearOnboardingV2Draft()             ← cleanup local pré-finalize
 *     3. scheduleWizardTimeout(300ms)         ← debounce contra re-entrância
 *     4. finishWizard():
 *          - finalizeOnboarding() (RPC atômica server-side)
 *          - se !ok → toast "Tentar novamente" (NÃO navega, NÃO COMPLETED)
 *          - se ok  → refetchProfile (fail-soft) + navigate(/sucesso)
 *     5. signalLifecyclePhase('COMPLETED')    ← APÓS await de finishWizard
 *   CONSUMERS: rota /onboarding-v2/sucesso, OnboardingGate, telemetria.
 *   OWNERSHIP: único disparador automático de submit terminal. Não
 *              duplicar finalize, não criar fallback write, não criar
 *              retry paralelo. `finalize_onboarding_atomic` continua
 *              sendo a ÚNICA autoridade transacional terminal.
 *   POSITION-DEPENDENCY: deve ser chamado APÓS o hook que declara
 *              `scheduleWizardTimeout` (E10/timer-helper) — não aplicável
 *              aqui pois usamos diretamente o helper de `wizardZombieGuard`.
 *
 * CLEANUP-SEQUENCE (preservada):
 *   - clearTimeout do timer 300ms (cleanup do effect)
 *   - clearOnboardingV2Draft já executado no fluxo síncrono
 *   - cleanup remoto/lock/sessionTouched/BetDraft delegados a
 *     `finalizeOnboarding` → permanecem fora do orchestrator.
 *
 * RETRY SEMANTICS (preservada):
 *   - Se `finishWizard` falhar (finalize !ok), lifecycle PERMANECE em
 *     'SUBMITTING' (signalLifecyclePhase('COMPLETED') só é chamado dentro
 *     do .then() — não há rejeição: finishWizard resolve sem lançar).
 *   - Retry continua possível via toast action ("Tentar novamente") que
 *     re-invoca `finishWizard()` diretamente.
 *   - Lifecycle NÃO regride a READY após falha.
 *
 * RACES MITIGADAS:
 *   R1 duplicate submit  : NEXT idempotente + monotonic lifecycle ref.
 *   R4 finalize duplication : finalize_onboarding_atomic + retry só via toast.
 *   R6 double redirect   : navigate(replace:true) + Gate gracetimes.
 *   R7 reconnect         : finishWizard resolve sem throw; toast retry.
 */
export function useSubmitCoreOrchestrator(
  options: UseSubmitCoreOrchestratorOptions,
): void {
  const { phase, deferCompletionToParent, signalLifecyclePhase, finishWizard } = options;

  useEffect(() => {
    if (phase !== 'done' || deferCompletionToParent) return;
    signalLifecyclePhase('SUBMITTING');
    clearOnboardingV2Draft();
    const timer = scheduleWizardTimeout(
      { phase: 'done', action: 'shell_finish_wizard', runIfStale: true },
      () => { void finishWizard().then(() => { signalLifecyclePhase('COMPLETED'); }); },
      300,
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deferCompletionToParent]);
}
