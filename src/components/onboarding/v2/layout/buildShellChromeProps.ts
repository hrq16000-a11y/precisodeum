/**
 * buildShellChromeProps — builder PURO de props para `OnboardingShellChrome`
 * (PR 14 — UI-only Shell Surface Reduction).
 *
 * Centraliza a derivação visual usada no shell V2 sem mover ownership de
 * runtime. Não acessa storage, refs, dispatch ou orchestrators — recebe
 * o snapshot já calculado pelo shell e devolve um objeto imutável de props.
 */
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';

interface BuildChromePropsInput {
  draftRestored: { source: 'local' | 'remote'; at?: string } | null;
  showAutoSaveBadge: boolean;
  autoSaveSignal: unknown;
  phase: OnboardingPhase;
}

export interface ShellChromeProps {
  draftRestored: { source: 'local' | 'remote'; at?: string } | null;
  showAutoSaveBadge: boolean;
  autoSaveSignal: unknown;
  phaseKey: string;
}

export const buildShellChromeProps = ({
  draftRestored,
  showAutoSaveBadge,
  autoSaveSignal,
  phase,
}: BuildChromePropsInput): ShellChromeProps => ({
  draftRestored,
  showAutoSaveBadge,
  autoSaveSignal,
  phaseKey: phase,
});

export default buildShellChromeProps;
