/**
 * buildPhaseVisualState — builder PURO que reagrupa derivações já
 * calculadas pelo `useOnboardingViewModel` em um objeto imutável tipado.
 *
 * PR 16 — consolidação final: mantém apenas os campos efetivamente
 * consumidos pelo `buildShellRenderState` / chrome. Sem hooks, sem refs,
 * sem effects.
 */
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';
import type { OnboardingViewModel } from '@/hooks/onboarding/useOnboardingViewModel';

export interface PhaseVisualState {
  readonly phase: OnboardingPhase;
  readonly phaseKey: string;
  readonly showAutoSaveBadge: boolean;
}

export const buildPhaseVisualState = (
  phase: OnboardingPhase,
  viewModel: OnboardingViewModel,
): PhaseVisualState => ({
  phase,
  phaseKey: phase,
  showAutoSaveBadge: viewModel.showAutoSaveBadge,
});

export default buildPhaseVisualState;
