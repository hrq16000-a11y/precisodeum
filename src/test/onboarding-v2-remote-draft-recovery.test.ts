/**
 * G5 — recuperação inteligente de rascunho remoto.
 *
 * Regra: o modal de recuperação deve aparecer SEMPRE que:
 *   (a) o rascunho local está vazio (phase1_action), OU
 *   (b) o rascunho remoto está em uma fase MAIS AVANÇADA que o local.
 *
 * Caso contrário (local já está igual ou à frente do remoto), o modal é
 * suprimido para não interromper o usuário desnecessariamente.
 *
 * Reproduzimos a mesma comparação canônica usada pelo OnboardingV2Shell.
 */
import { describe, it, expect } from 'vitest';
import { phaseIndex } from '@/components/onboarding/wizard/phases/v2/state';
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';

/** Mesma decisão usada no Shell (mantida em sync com o efeito real). */
function shouldShowRemoteRecoveryModal(
  localPhase: OnboardingPhase | null | undefined,
  remotePhase: OnboardingPhase | null | undefined,
): boolean {
  if (!remotePhase) return false;
  const localResolved = (localPhase as OnboardingPhase) || 'phase1_action';
  const remoteIdx = phaseIndex(remotePhase);
  const localIdx = phaseIndex(localResolved);
  const remoteIsAhead = remoteIdx > localIdx;
  const localIsEmpty = !localPhase || localResolved === 'phase1_action';
  return localIsEmpty || remoteIsAhead;
}

describe('G5 — RemoteDraftRecoveryModal: regra de exibição', () => {
  it('mostra o modal quando o local está VAZIO (phase1_action) e o remoto existe', () => {
    expect(shouldShowRemoteRecoveryModal('phase1_action', 'phase1_action')).toBe(true);
    expect(shouldShowRemoteRecoveryModal(null, 'phase1_contact')).toBe(true);
    expect(shouldShowRemoteRecoveryModal(undefined, 'phase2_service')).toBe(true);
  });

  it('mostra o modal quando remoto está MAIS À FRENTE que o local (mesmo na fase inicial)', () => {
    // Local na primeira fase real, remoto avançado — DEVE aparecer.
    expect(shouldShowRemoteRecoveryModal('phase1_kind', 'phase2_details')).toBe(true);
    expect(shouldShowRemoteRecoveryModal('phase1_contact', 'phase2_service')).toBe(true);
    expect(shouldShowRemoteRecoveryModal('phase2_service', 'phase4_review')).toBe(true);
  });

  it('NÃO mostra quando local está IGUAL ao remoto', () => {
    expect(shouldShowRemoteRecoveryModal('phase2_service', 'phase2_service')).toBe(false);
    expect(shouldShowRemoteRecoveryModal('phase4_extras_a', 'phase4_extras_a')).toBe(false);
  });

  it('NÃO mostra quando local está MAIS À FRENTE que o remoto', () => {
    expect(shouldShowRemoteRecoveryModal('phase4_review', 'phase2_service')).toBe(false);
    expect(shouldShowRemoteRecoveryModal('phase2_details', 'phase1_contact')).toBe(false);
  });

  it('NÃO mostra quando o remoto não existe', () => {
    expect(shouldShowRemoteRecoveryModal('phase2_service', null)).toBe(false);
    expect(shouldShowRemoteRecoveryModal('phase1_action', undefined)).toBe(false);
  });

  it('caso de borda: local em phase1_action sempre é tratado como "vazio"', () => {
    // Mesmo se o remoto ainda for phase1_action, considera-se vazio → mostra
    // para o usuário decidir entre continuar ou começar do zero.
    expect(shouldShowRemoteRecoveryModal('phase1_action', 'phase1_action')).toBe(true);
  });
});
