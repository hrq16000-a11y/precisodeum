/**
 * buildPhaseVisualState — builder PURO (sem hooks, sem refs, sem side-effects)
 * que reagrupa derivações já calculadas pelo `useOnboardingViewModel` em um
 * único objeto imutável tipado, pronto para consumo declarativo no shell.
 *
 * Não duplica regras de fase: lê o ViewModel + a fase corrente e devolve
 * o mesmo conjunto de booleans/strings já validados em testes, evitando
 * que o shell precise referenciar 4–5 campos avulsos no tail JSX.
 *
 * PR 15 — Final Shell Density Pass (UI-only).
 */
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';
import type { OnboardingViewModel } from '@/hooks/onboarding/useOnboardingViewModel';

export interface PhaseVisualState {
  readonly phase: OnboardingPhase;
  readonly phaseKey: string;
  readonly isTerminalPhase: boolean;
  readonly isRepairPhase: boolean;
  readonly showProgressChrome: boolean;
  readonly showCompletionChrome: boolean;
  readonly showAutoSaveBadge: boolean;
  readonly showDraftBanner: boolean;
  readonly showEncouragement: boolean;
  readonly usesCompactLayout: boolean;
  readonly isMigratedPhase: boolean;
  readonly isMediaFlow: boolean;
  readonly isProfileCompletionFlow: boolean;
}

export const buildPhaseVisualState = (
  phase: OnboardingPhase,
  viewModel: OnboardingViewModel,
): PhaseVisualState => ({
  phase,
  phaseKey: phase,
  isTerminalPhase: viewModel.isTerminalPhase,
  isRepairPhase: viewModel.isRepairPhase,
  showProgressChrome: viewModel.showProgressChrome,
  showCompletionChrome: viewModel.showCompletionChrome,
  showAutoSaveBadge: viewModel.showAutoSaveBadge,
  showDraftBanner: viewModel.showDraftBanner,
  showEncouragement: viewModel.showEncouragement,
  usesCompactLayout: viewModel.usesCompactLayout,
  isMigratedPhase: viewModel.isMigratedPhase,
  isMediaFlow: viewModel.isMediaFlow,
  isProfileCompletionFlow: viewModel.isProfileCompletionFlow,
});

export default buildPhaseVisualState;
