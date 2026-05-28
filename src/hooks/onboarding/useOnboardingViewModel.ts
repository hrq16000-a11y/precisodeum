/**
 * useOnboardingViewModel — derivações puramente VISUAIS do OnboardingV2Shell.
 *
 * Camada de composição (PR 9 — UI Composition Pass; expandida em PR 10).
 * Não toca runtime:
 *   ❌ não persiste, não hidrata, não fetch, não despacha reducer,
 *      não toca localStorage, cross-tab, lifecycle, refs ou writes.
 *   ✅ apenas memoiza booleans/derivações que o JSX consome.
 *
 * Adicione aqui novas flags derivadas para evitar recálculo inline no shell.
 */
import { useMemo } from 'react';
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';

interface OnboardingViewModelInput {
  phase: OnboardingPhase;
}

export interface OnboardingViewModel {
  /** Verdadeiro a partir da celebração (inclusive) — usado para barras/copy. */
  isCelebrationOrLater: boolean;
  /** Quando exibir o badge de autosave no topo do card. */
  showAutoSaveBadge: boolean;
  /** Fase terminal — o shell pode pular renderizações específicas. */
  isTerminal: boolean;
  /** Fase auxiliar de reparo de contato (fora do PHASE_ORDER principal). */
  isRepairPhase: boolean;
  /** Fase está coberta pelo router declarativo `phaseComponentMap`. */
  isMigratedPhase: boolean;
}

const CELEBRATION_OR_LATER = new Set<OnboardingPhase>([
  'phase3_celebration',
  'phase4_document',
  'phase4_extras_a',
  'phase4_extras_b',
  'done',
]);

const MIGRATED_PHASES = new Set<OnboardingPhase>([
  'phase2_service',
  'phase2_details',
  'phase4_extras_a',
  'phase4_extras_b',
]);

export function useOnboardingViewModel({ phase }: OnboardingViewModelInput): OnboardingViewModel {
  return useMemo(
    () => ({
      isCelebrationOrLater: CELEBRATION_OR_LATER.has(phase),
      // Mantém o contrato visual original do shell: o badge só some na 1ª
      // fase (`phase2_service`) e na tela terminal (`done`).
      showAutoSaveBadge: phase !== 'phase2_service' && phase !== 'done',
      isTerminal: phase === 'done',
      isRepairPhase: phase === 'phase_repair_contact',
      isMigratedPhase: MIGRATED_PHASES.has(phase),
    }),
    [phase],
  );
}
