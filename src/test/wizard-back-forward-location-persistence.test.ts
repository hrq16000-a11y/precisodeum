/**
 * Integração: city/state/neighborhood persistem ao Voltar/Avançar até a etapa 19
 * (phase4_extras_b).
 *
 * Cobre o reducer real + flushLocalDraft. Garantia: os campos de localização
 * preenchidos na entrada do V2 (vindos da triagem) NÃO são perdidos ao
 * navegar entre as fases finais (document → avatar → extras_a → extras_b)
 * e voltar atrás múltiplas vezes.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  initialOnboardingState,
  onboardingReducer,
} from '@/components/onboarding/wizard/phases/v2/state';
import {
  flushLocalDraft,
} from '@/components/onboarding/wizard/phases/v2/flushDraft';

const DRAFT_KEY = 'onboarding_v3_institutional_final';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { localStorage.clear(); });

describe('Integração — city/state/neighborhood preservados Voltar/Avançar', () => {
  it('avança até phase4_extras_b e volta sem perder localização', () => {
    let state = onboardingReducer(initialOnboardingState, {
      type: 'PATCH_PROFILE',
      patch: { city: 'Curitiba', state: 'PR', neighborhood: 'Centro', kind: 'pf' },
    });

    const path = [
      'phase2_details',
      'phase2_photos',
      'phase3_celebration',
      'phase4_document',
      'phase4_avatar',
      'phase4_extras_a',
      'phase4_extras_b',
    ] as const;

    for (const phase of path) {
      state = onboardingReducer(state, { type: 'GO_TO', phase });
      expect(state.profile.city).toBe('Curitiba');
      expect(state.profile.state).toBe('PR');
      expect(state.profile.neighborhood).toBe('Centro');
    }

    // Voltar 7x até phase2_service
    const back = [...path].reverse().slice(1).concat(['phase2_service' as any]);
    for (const phase of back) {
      state = onboardingReducer(state, { type: 'GO_TO', phase });
      expect(state.profile.city).toBe('Curitiba');
      expect(state.profile.state).toBe('PR');
      expect(state.profile.neighborhood).toBe('Centro');
    }

    // Avança de novo até a 19 (phase4_extras_b) e confirma persistência
    for (const phase of path) {
      state = onboardingReducer(state, { type: 'GO_TO', phase });
    }
    expect(state.phase).toBe('phase4_extras_b');
    expect(state.profile.city).toBe('Curitiba');
    expect(state.profile.state).toBe('PR');
    expect(state.profile.neighborhood).toBe('Centro');
  });

  it('flushLocalDraft preserva location no localStorage entre navegações', () => {
    let state = onboardingReducer(initialOnboardingState, {
      type: 'PATCH_PROFILE',
      patch: { city: 'São Paulo', state: 'SP', neighborhood: 'Pinheiros' },
    });
    state = onboardingReducer(state, { type: 'GO_TO', phase: 'phase4_extras_b' });
    flushLocalDraft(state);

    const raw = localStorage.getItem(DRAFT_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.profile.city).toBe('São Paulo');
    expect(parsed.profile.state).toBe('SP');
    expect(parsed.profile.neighborhood).toBe('Pinheiros');
    expect(parsed.phase).toBe('phase4_extras_b');

    // Voltar e re-flush — localStorage continua íntegro
    state = onboardingReducer(state, { type: 'GO_TO', phase: 'phase4_extras_a' });
    flushLocalDraft(state);
    const parsed2 = JSON.parse(localStorage.getItem(DRAFT_KEY)!);
    expect(parsed2.profile.city).toBe('São Paulo');
    expect(parsed2.profile.state).toBe('SP');
    expect(parsed2.profile.neighborhood).toBe('Pinheiros');
  });

  it('PATCH_PROFILE não-destrutivo: avançar com patch parcial não apaga campos antigos', () => {
    let state = onboardingReducer(initialOnboardingState, {
      type: 'PATCH_PROFILE',
      patch: { city: 'Belo Horizonte', state: 'MG', neighborhood: 'Savassi' },
    });
    state = onboardingReducer(state, { type: 'GO_TO', phase: 'phase4_extras_b' });

    // Patch só com instagram (cenário típico do extras_b)
    state = onboardingReducer(state, {
      type: 'PATCH_PROFILE',
      patch: { instagram_url: 'https://instagram.com/test' },
    });

    expect(state.profile.city).toBe('Belo Horizonte');
    expect(state.profile.state).toBe('MG');
    expect(state.profile.neighborhood).toBe('Savassi');
    expect(state.profile.instagram_url).toBe('https://instagram.com/test');
  });
});
