/**
 * useOnboardingViewModel — derivações puramente VISUAIS do OnboardingV2Shell.
 *
 * Camada de composição (PR 9 — UI Composition Pass; consolidada em PR 16).
 * Após a sweep de superfícies mortas, este hook entrega APENAS o boolean
 * efetivamente consumido pelo chrome (`showAutoSaveBadge`). Booleans não
 * consumidos foram removidos para diminuir a superfície pública interna.
 *
 * Não toca runtime:
 *   ❌ não persiste, não hidrata, não fetch, não despacha reducer,
 *      não toca localStorage, cross-tab, lifecycle, refs ou writes.
 *   ✅ apenas memoiza booleans que o JSX/builder consome.
 */
import { useMemo } from 'react';
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';

interface OnboardingViewModelInput {
  readonly phase: OnboardingPhase;
}

export interface OnboardingViewModel {
  /**
   * Quando exibir o badge de autosave no topo do card. O badge some na
   * 1ª fase (`phase2_service`) e na tela terminal (`done`).
   */
  readonly showAutoSaveBadge: boolean;
}

export function useOnboardingViewModel({ phase }: OnboardingViewModelInput): OnboardingViewModel {
  return useMemo<OnboardingViewModel>(
    () => ({
      showAutoSaveBadge: phase !== 'phase2_service' && phase !== 'done',
    }),
    [phase],
  );
}
