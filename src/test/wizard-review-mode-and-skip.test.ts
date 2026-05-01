/**
 * Validação contratual:
 *  1. `?mode=review` (e o alias `?review=1`) sempre resolvem para WizardMode='edit_profile'.
 *  2. `isPhaseFullyCompleted` (gate do botão "Pular") só retorna true quando TODOS
 *     os campos obrigatórios da fase estão preenchidos — base do `<EditModeSkipButton>`.
 */
import { describe, it, expect } from 'vitest';
import {
  isOnboardingReviewMode,
  getOnboardingReviewSection,
} from '@/lib/onboardingAccess';
import { resolveWizardMode, isPhaseFullyCompleted } from '@/components/onboarding/wizard/wizardMode';
import type { WizardState } from '@/components/onboarding/wizard/wizardReducer';

// Helper: estado mínimo do wizard para os testes (não requer todas as fases).
function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    phase: 'main_action',
    triage: {} as any,
    profile: {} as any,
    service: {} as any,
    providerId: null,
    firstServiceId: null,
    ...overrides,
  } as WizardState;
}

describe('?mode=review → WizardMode=edit_profile', () => {
  it('mode=review é detectado como review mode', () => {
    expect(isOnboardingReviewMode('?mode=review')).toBe(true);
  });

  it('alias review=1 também detecta review mode', () => {
    expect(isOnboardingReviewMode('?review=1')).toBe(true);
  });

  it('section= sozinho também ativa review mode', () => {
    expect(isOnboardingReviewMode('?section=cadastro')).toBe(true);
    expect(getOnboardingReviewSection('?section=cadastro')).toBe('cadastro');
  });

  it('sem parâmetros NÃO é review mode', () => {
    expect(isOnboardingReviewMode('')).toBe(false);
    expect(isOnboardingReviewMode('?next=/dashboard')).toBe(false);
  });

  it('resolveWizardMode mapeia reviewMode=true (vindo do isOnboardingReviewMode) para edit_profile', () => {
    // Simula o que CadastroInicialPage faz: lê isOnboardingReviewMode da URL e
    // passa como reviewMode para o WizardShell.
    const reviewMode = isOnboardingReviewMode('?mode=review');
    const mode = resolveWizardMode({ reviewMode });
    expect(mode).toBe('edit_profile');
  });

  it('resolveWizardMode prioriza prop `mode` explícita sobre `reviewMode`', () => {
    // Garante que, ao migrar consumidores para passar `mode` direto,
    // o boolean deprecated não ofusque a escolha explícita.
    expect(resolveWizardMode({ mode: 'add_service', reviewMode: true })).toBe('add_service');
    expect(resolveWizardMode({ mode: 'new_signup' })).toBe('new_signup');
  });

  it('sem mode e sem reviewMode → new_signup (default seguro)', () => {
    expect(resolveWizardMode({})).toBe('new_signup');
    expect(resolveWizardMode({ reviewMode: false })).toBe('new_signup');
  });
});

describe('isPhaseFullyCompleted — botão "Pular" só aparece com TODOS os obrigatórios preenchidos', () => {
  it('main_contact: requer full_name E whatsapp', () => {
    expect(isPhaseFullyCompleted(makeState({ profile: { full_name: 'Ana' } as any }), 'main_contact')).toBe(false);
    expect(isPhaseFullyCompleted(makeState({ profile: { whatsapp: '11999999999' } as any }), 'main_contact')).toBe(false);
    expect(
      isPhaseFullyCompleted(
        makeState({ profile: { full_name: 'Ana', whatsapp: '11999999999' } as any }),
        'main_contact',
      ),
    ).toBe(true);
  });

  it('main_location: requer city E state', () => {
    expect(isPhaseFullyCompleted(makeState({ profile: { city: 'SP' } as any }), 'main_location')).toBe(false);
    expect(isPhaseFullyCompleted(makeState({ profile: { state: 'SP' } as any }), 'main_location')).toBe(false);
    expect(
      isPhaseFullyCompleted(
        makeState({ profile: { city: 'São Paulo', state: 'SP' } as any }),
        'main_location',
      ),
    ).toBe(true);
  });

  it('main_service: requer ao menos 1 category_id', () => {
    expect(isPhaseFullyCompleted(makeState({ service: { category_ids: [] } as any }), 'main_service')).toBe(false);
    expect(
      isPhaseFullyCompleted(makeState({ service: { category_ids: ['cat-1'] } as any }), 'main_service'),
    ).toBe(true);
  });

  it('main_service_details: requer name + description + cities_served', () => {
    const incomplete = makeState({
      service: { service_name: 'Pintura', description: '', cities_served: ['SP'] } as any,
    });
    expect(isPhaseFullyCompleted(incomplete, 'main_service_details')).toBe(false);

    const incompleteCities = makeState({
      service: { service_name: 'Pintura', description: 'desc', cities_served: [] } as any,
    });
    expect(isPhaseFullyCompleted(incompleteCities, 'main_service_details')).toBe(false);

    const complete = makeState({
      service: {
        service_name: 'Pintura',
        description: 'Pintura residencial completa',
        cities_served: ['São Paulo'],
      } as any,
    });
    expect(isPhaseFullyCompleted(complete, 'main_service_details')).toBe(true);
  });

  it('main_extras_a: requer neighborhood E bio', () => {
    expect(
      isPhaseFullyCompleted(makeState({ profile: { neighborhood: 'Centro' } as any }), 'main_extras_a'),
    ).toBe(false);
    expect(
      isPhaseFullyCompleted(
        makeState({ profile: { neighborhood: 'Centro', bio: 'Trabalho desde 2010' } as any }),
        'main_extras_a',
      ),
    ).toBe(true);
  });

  it('main_photos: sempre considerado completo (foto é opcional por design)', () => {
    expect(isPhaseFullyCompleted(makeState(), 'main_photos')).toBe(true);
  });

  it('main_extras_b: redes sociais opcionais → sempre completo', () => {
    expect(isPhaseFullyCompleted(makeState(), 'main_extras_b')).toBe(true);
  });

  it('strings com apenas espaços NÃO contam como preenchidas', () => {
    expect(
      isPhaseFullyCompleted(
        makeState({ profile: { full_name: '   ', whatsapp: '11999999999' } as any }),
        'main_contact',
      ),
    ).toBe(false);
  });

  it('fases sem regra explícita (ex.: main_celebration, main_more_services) retornam false (não exibem Pular)', () => {
    expect(isPhaseFullyCompleted(makeState(), 'main_celebration')).toBe(false);
    expect(isPhaseFullyCompleted(makeState(), 'main_more_services')).toBe(false);
  });
});
