/**
 * useWizardExitGuard · regressão.
 *
 * Cenários:
 *  1) Em phase2_service / details / photos, navegar para /dashboard é
 *     redirecionado para /cadastro-inicial e dispara `onBlocked`.
 *  2) Em phase3_celebration ou superior, NADA é bloqueado.
 *  3) Em editMode (enabled=false), nada é bloqueado.
 *  4) `isWizardPhaseProtected` e `nextPhaseAfterBlock` têm contrato estável.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  useWizardExitGuard,
  isWizardPhaseProtected,
  nextPhaseAfterBlock,
} from '@/hooks/useWizardExitGuard';
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';

function wrapper(initialPath: string) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('useWizardExitGuard · contrato', () => {
  it('isWizardPhaseProtected reconhece SOMENTE phase2_*', () => {
    const protectedPhases: OnboardingPhase[] = [
      'phase2_service', 'phase2_details', 'phase2_photos',
    ];
    for (const p of protectedPhases) {
      expect(isWizardPhaseProtected(p)).toBe(true);
    }
    const safe: OnboardingPhase[] = [
      'phase3_celebration', 'phase4_document', 'phase4_avatar',
      'phase4_extras_a', 'phase4_extras_b', 'done',
    ];
    for (const p of safe) {
      expect(isWizardPhaseProtected(p)).toBe(false);
    }
  });

  it('nextPhaseAfterBlock encadeia corretamente', () => {
    expect(nextPhaseAfterBlock('phase2_service')).toBe('phase2_details');
    expect(nextPhaseAfterBlock('phase2_details')).toBe('phase2_photos');
    expect(nextPhaseAfterBlock('phase2_photos')).toBe('phase2_photos');
  });

  it('Bloqueia /dashboard em phase2_photos e dispara onBlocked', () => {
    const onBlocked = vi.fn();
    renderHook(
      () => useWizardExitGuard({ phase: 'phase2_photos', onBlocked }),
      { wrapper: wrapper('/dashboard') },
    );
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(onBlocked).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'phase2_photos', attemptedPath: '/dashboard' }),
    );
  });

  it('NÃO bloqueia em phase3_celebration', () => {
    const onBlocked = vi.fn();
    renderHook(
      () => useWizardExitGuard({ phase: 'phase3_celebration', onBlocked }),
      { wrapper: wrapper('/dashboard') },
    );
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('Quando enabled=false, não bloqueia mesmo em phase2_photos', () => {
    const onBlocked = vi.fn();
    renderHook(
      () => useWizardExitGuard({ phase: 'phase2_photos', enabled: false, onBlocked }),
      { wrapper: wrapper('/dashboard') },
    );
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('Em rota neutra (/cadastro-inicial), não bloqueia mesmo em phase2_*', () => {
    const onBlocked = vi.fn();
    renderHook(
      () => useWizardExitGuard({ phase: 'phase2_service', onBlocked }),
      { wrapper: wrapper('/cadastro-inicial') },
    );
    expect(onBlocked).not.toHaveBeenCalled();
  });
});
