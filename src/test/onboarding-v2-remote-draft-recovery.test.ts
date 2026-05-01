/**
 * G5 — recuperação inteligente de rascunho remoto.
 *
 * Regra: o modal de recuperação deve aparecer SEMPRE que:
 *   (a) o rascunho local está vazio (fase inicial = phase2_service após mai/2026), OU
 *   (b) o rascunho remoto está em uma fase MAIS AVANÇADA que o local.
 *
 * Caso contrário (local já está igual ou à frente do remoto), o modal é
 * suprimido para não interromper o usuário desnecessariamente.
 *
 * Reproduzimos a mesma comparação canônica usada pelo OnboardingV2Shell.
 *
 * Nota mai/2026: phase1_action/kind/location/contact foram removidas na
 * consolidação Bet Mode — esses dados agora vêm 100% da triagem. A 1ª fase
 * viva do V2 passou a ser phase2_service.
 */
import { describe, it, expect } from 'vitest';
import { phaseIndex } from '@/components/onboarding/wizard/phases/v2/state';
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';

const INITIAL_PHASE: OnboardingPhase = 'phase2_service';

/** Mesma decisão usada no Shell (mantida em sync com o efeito real). */
function shouldShowRemoteRecoveryModal(
  localPhase: OnboardingPhase | null | undefined,
  remotePhase: OnboardingPhase | null | undefined,
): boolean {
  if (!remotePhase) return false;
  const localResolved = (localPhase as OnboardingPhase) || INITIAL_PHASE;
  const remoteIdx = phaseIndex(remotePhase);
  const localIdx = phaseIndex(localResolved);
  const remoteIsAhead = remoteIdx > localIdx;
  const localIsEmpty = !localPhase || localResolved === INITIAL_PHASE;
  return localIsEmpty || remoteIsAhead;
}

describe('G5 — RemoteDraftRecoveryModal: regra de exibição', () => {
  it('mostra o modal quando o local está VAZIO (phase2_service) e o remoto existe', () => {
    expect(shouldShowRemoteRecoveryModal('phase2_service', 'phase2_service')).toBe(true);
    expect(shouldShowRemoteRecoveryModal(null, 'phase2_details')).toBe(true);
    expect(shouldShowRemoteRecoveryModal(undefined, 'phase4_avatar')).toBe(true);
  });

  it('mostra o modal quando remoto está MAIS À FRENTE que o local', () => {
    expect(shouldShowRemoteRecoveryModal('phase2_service', 'phase2_details')).toBe(true);
    expect(shouldShowRemoteRecoveryModal('phase2_details', 'phase4_document')).toBe(true);
    expect(shouldShowRemoteRecoveryModal('phase2_service', 'done')).toBe(true);
  });

  it('NÃO mostra quando local está IGUAL ao remoto (e não é a fase inicial)', () => {
    expect(shouldShowRemoteRecoveryModal('phase2_details', 'phase2_details')).toBe(false);
    expect(shouldShowRemoteRecoveryModal('phase4_extras_a', 'phase4_extras_a')).toBe(false);
  });

  it('NÃO mostra quando local está MAIS À FRENTE que o remoto', () => {
    expect(shouldShowRemoteRecoveryModal('done', 'phase2_service')).toBe(false);
    expect(shouldShowRemoteRecoveryModal('phase4_document', 'phase2_details')).toBe(false);
  });

  it('NÃO mostra quando o remoto não existe', () => {
    expect(shouldShowRemoteRecoveryModal('phase2_service', null)).toBe(false);
    expect(shouldShowRemoteRecoveryModal('phase2_details', undefined)).toBe(false);
  });

  it('caso de borda: local em phase2_service (1ª fase) é tratado como "vazio"', () => {
    // Mesmo se o remoto também estiver na 1ª fase, mostramos para o usuário
    // decidir entre continuar ou começar do zero.
    expect(shouldShowRemoteRecoveryModal('phase2_service', 'phase2_service')).toBe(true);
  });
});
