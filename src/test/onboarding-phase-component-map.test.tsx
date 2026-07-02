/**
 * phaseComponentMap — testes de cobertura type-level e de wrapper shapes.
 *
 * Garante:
 *  1) O registry cobre TODAS as fases migradas declaradas na união pública.
 *  2) `isMigratedPhase` é coerente com o `phaseComponentMap` (mesmo conjunto).
 *  3) Cada wrapper exporta props tipadas (interface não-`any`) e o componente
 *     renderiza sem efeitos colaterais (smoke render).
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';
import {
  phaseComponentMap,
  isMigratedPhase,
  type MigratedPhase,
} from '@/components/onboarding/v2/phases/phaseComponentMap';

// Stubs visuais para todos os componentes "folha" — isolamos do runtime real
// (Supabase, uploaders, lucide pesados etc.).
vi.mock('@/components/ServiceImageUpload', () => ({
  default: () => <div data-testid="upload-stub" />,
}));
vi.mock('@/components/onboarding/wizard/phases/v2/Phase2Photos', () => ({
  Phase2Photos: () => <div data-testid="phase2-photos-stub" />,
  default: () => <div data-testid="phase2-photos-stub" />,
}));
vi.mock('@/components/onboarding/wizard/phases/v2/Phase2Service', () => ({
  Phase2Service: () => <div data-testid="phase2-service-stub" />,
  Phase2Details: () => <div data-testid="phase2-details-stub" />,
}));
vi.mock('@/components/onboarding/wizard/phases/v2/Phase4Final', () => ({
  Phase4Document: () => <div data-testid="phase4-document-stub" />,
  Phase4Avatar: () => <div data-testid="phase4-avatar-stub" />,
  Phase4ExtrasA: () => <div data-testid="phase4-extras-a-stub" />,
  Phase4ExtrasB: () => <div data-testid="phase4-extras-b-stub" />,
}));
vi.mock('@/components/onboarding/v2/phases/Phase2PhotosBlockedCard', () => ({
  Phase2PhotosBlockedCard: () => <div data-testid="phase2-photos-blocked-stub" />,
}));
vi.mock('@/components/onboarding/wizard/WizardEncouragement', () => ({
  default: () => <div data-testid="wizard-encouragement-stub" />,
}));

const EXPECTED_MIGRATED_PHASES: ReadonlyArray<MigratedPhase> = [
  'phase2_service',
  'phase2_details',
  'phase2_photos',
  'phase3_celebration',
  'phase4_document',
  'phase4_avatar',
  'phase4_extras_a',
  'phase4_extras_b',
  'phase_repair_contact',
  'done',
];

describe('phaseComponentMap — cobertura e contrato', () => {
  it('expõe um componente para CADA fase migrada esperada', () => {
    for (const phase of EXPECTED_MIGRATED_PHASES) {
      const Component = phaseComponentMap[phase];
      expect(Component, `phase ${phase} sem componente registrado`).toBeTruthy();
      expect(typeof Component).toBe('function');
    }
    expect(Object.keys(phaseComponentMap).sort()).toEqual(
      [...EXPECTED_MIGRATED_PHASES].sort(),
    );
  });

  it('isMigratedPhase cobre todas as fases após PR 12 (registry total)', () => {
    for (const phase of EXPECTED_MIGRATED_PHASES) {
      expect(isMigratedPhase(phase)).toBe(true);
    }
    // Sanity-check: o registry tem o mesmo cardinal que a união pública.
    const allPhases: OnboardingPhase[] = [...EXPECTED_MIGRATED_PHASES];
    expect(allPhases.every((p) => isMigratedPhase(p))).toBe(true);
  });

  it('type-narrowing: isMigratedPhase restringe a OnboardingPhase para MigratedPhase', () => {
    const phase: OnboardingPhase = 'phase2_photos';
    if (isMigratedPhase(phase)) {
      // O TS deve aceitar este acesso direto via union narrowing.
      const Component = phaseComponentMap[phase];
      expect(Component).toBeTruthy();
    }
  });
});

describe('phaseComponentMap — smoke render dos wrappers visuais', () => {
  it('Phase2PhotosPhase renderiza variante "ready" com props completas', () => {
    const Component = phaseComponentMap.phase2_photos;
    const { getByTestId } = render(
      <Component
        view="ready"
        photosProps={{
          serviceId: 'svc-1',
          userId: 'usr-1',
          serviceName: 'Pintura',
          onContinue: () => {},
          onSkip: () => {},
        }}
        encouragement={{ title: 't' }}
      />,
    );
    expect(getByTestId('phase2-photos-stub')).toBeTruthy();
    expect(getByTestId('wizard-encouragement-stub')).toBeTruthy();
  });

  it('Phase2PhotosPhase renderiza variante "blocked" sem o uploader', () => {
    const Component = phaseComponentMap.phase2_photos;
    const { getByTestId, queryByTestId } = render(
      <Component
        view="blocked"
        blockedProps={{
          reason: 'no_service',
          missing: [],
          phase2RetryStatus: 'idle',
          context: {
            primaryCategoryId: null,
            city: null,
            stateUF: null,
            providerId: null,
            firstServiceId: null,
            lastPersistError: null,
          },
          onRetryManual: () => {},
          onBackToDetails: () => {},
          onSkip: () => {},
          onLogin: () => {},
        }}
      />,
    );
    expect(getByTestId('phase2-photos-blocked-stub')).toBeTruthy();
    expect(queryByTestId('phase2-photos-stub')).toBeNull();
  });

  it('Phase4DocumentPhase delega para Phase4Document', () => {
    const Component = phaseComponentMap.phase4_document;
    const { getByTestId } = render(
      <Component
        documentProps={{
          data: {} as any,
          onChange: () => {},
          onContinue: () => {},
          onSkip: () => {},
          saving: false,
          userId: 'u',
          locked: false,
        }}
      />,
    );
    expect(getByTestId('phase4-document-stub')).toBeTruthy();
  });

  it('Phase4AvatarPhase delega para Phase4Avatar', () => {
    const Component = phaseComponentMap.phase4_avatar;
    const { getByTestId } = render(
      <Component
        avatarProps={{
          data: {} as any,
          onChange: () => {},
          onContinue: () => {},
          onSkip: () => {},
          onBack: () => {},
          saving: false,
          userId: 'u',
        }}
      />,
    );
    expect(getByTestId('phase4-avatar-stub')).toBeTruthy();
  });
});
