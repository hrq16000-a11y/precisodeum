/**
 * useReviewHistoryCleanup — limpa a pilha de histórico de revisão ao SAIR
 * do modo `edit_profile`.
 *
 * PR 17 — Shell Surface Slimming. Extração 1:1 do effect de cleanup do
 * `OnboardingV2Shell`. Garante que pilha velha não vaze para uma próxima
 * sessão de revisão na mesma aba (cenário: usuário volta para new_signup).
 *
 * Trivial / sem side-effects além do `clearReviewHistory()`.
 */
import { useEffect } from 'react';
import { clearReviewHistory } from '@/components/onboarding/wizard/phases/v2/reviewHistory';

export function useReviewHistoryCleanup(editMode: boolean): void {
  useEffect(() => {
    if (!editMode) clearReviewHistory();
  }, [editMode]);
}

export default useReviewHistoryCleanup;
