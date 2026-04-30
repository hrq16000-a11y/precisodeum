/**
 * Teste E2E (lógica) do fluxo do Wizard.
 *
 * Valida invariantes do reducer público (`wizardReducer`) que governa o
 * progresso global do onboarding unificado:
 *  - Avançar por todas as fases não cria loops nem pula etapas obrigatórias
 *    (CNPJ/Documento, Localização) na trilha do profissional.
 *  - Voltar (GO_TO_PHASE para uma fase anterior) preserva os dados já
 *    coletados (não apaga `triage`, `profile`, `service`).
 *  - O índice de fase é monotônico durante o avanço; ao voltar, ele
 *    realmente recua (sem ficar travado).
 *  - A fase final ('done') é alcançável avançando pela ordem do provider.
 */
import { describe, it, expect } from 'vitest';
import {
  initialWizardState,
  wizardReducer,
  PROVIDER_WIZARD_PHASE_ORDER,
  unifiedPhaseIndex,
} from '@/components/onboarding/wizard/wizardReducer';

describe('Wizard E2E — fluxo de avanço/retrocesso (provider track)', () => {
  it('PROVIDER_WIZARD_PHASE_ORDER inclui CNPJ/Documento e Localização', () => {
    expect(PROVIDER_WIZARD_PHASE_ORDER).toContain('triage_pro_document');
    expect(PROVIDER_WIZARD_PHASE_ORDER).toContain('triage_pro_location');
    // CNPJ vem antes da localização base.
    const docIdx = PROVIDER_WIZARD_PHASE_ORDER.indexOf('triage_pro_document');
    const locIdx = PROVIDER_WIZARD_PHASE_ORDER.indexOf('triage_pro_location');
    expect(docIdx).toBeGreaterThan(-1);
    expect(locIdx).toBeGreaterThan(docIdx);
  });

  it('avançar pela ordem do provider termina em "done" sem repetir fases', () => {
    let state = initialWizardState;
    const visited: string[] = [];
    for (const phase of PROVIDER_WIZARD_PHASE_ORDER) {
      state = wizardReducer(state, { type: 'GO_TO_PHASE', phase });
      visited.push(state.phase);
    }
    // Sem duplicatas
    expect(new Set(visited).size).toBe(visited.length);
    // Termina na última fase definida
    expect(state.phase).toBe(PROVIDER_WIZARD_PHASE_ORDER[PROVIDER_WIZARD_PHASE_ORDER.length - 1]);
  });

  it('Voltar (GO_TO_PHASE para fase anterior) não cria loop nem reseta dados', () => {
    let state = initialWizardState;
    // Hidrata como se o usuário tivesse preenchido triagem.
    state = wizardReducer(state, {
      type: 'HYDRATE',
      state: {
        phase: 'triage_pro_location',
        triage: {
          ...state.triage,
          intent: 'professional',
          full_name: 'Fulano da Silva',
          whatsapp: '41999999999',
          city: 'Curitiba',
          state: 'PR',
        },
      },
    });
    expect(state.triage.full_name).toBe('Fulano da Silva');

    // Volta duas fases.
    state = wizardReducer(state, { type: 'GO_TO_PHASE', phase: 'triage_pro_document' });
    expect(state.phase).toBe('triage_pro_document');
    expect(state.triage.full_name).toBe('Fulano da Silva'); // dados preservados
    expect(state.triage.city).toBe('Curitiba');

    // Avança de novo — mesmo destino, sem efeito colateral.
    state = wizardReducer(state, { type: 'GO_TO_PHASE', phase: 'triage_pro_location' });
    expect(state.phase).toBe('triage_pro_location');
    expect(state.triage.whatsapp).toBe('41999999999');
  });

  it('índice de fase avança monotonicamente e recua corretamente', () => {
    let state = initialWizardState;
    const indices: number[] = [unifiedPhaseIndex(state.phase)];
    for (const phase of PROVIDER_WIZARD_PHASE_ORDER.slice(0, 5)) {
      state = wizardReducer(state, { type: 'GO_TO_PHASE', phase });
      indices.push(unifiedPhaseIndex(state.phase));
    }
    // Cresce
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
    }
    // Volta — índice deve diminuir.
    const before = unifiedPhaseIndex(state.phase);
    state = wizardReducer(state, { type: 'GO_TO_PHASE', phase: PROVIDER_WIZARD_PHASE_ORDER[0] });
    expect(unifiedPhaseIndex(state.phase)).toBeLessThan(before);
  });

  it('GO_TO_PHASE idempotente — chamar com a mesma fase não muta outros campos', () => {
    let state = initialWizardState;
    state = wizardReducer(state, {
      type: 'HYDRATE',
      state: { phase: 'main_service', service: { ...state.service, service_name: 'Pintura' } },
    });
    const before = state;
    const after = wizardReducer(before, { type: 'GO_TO_PHASE', phase: 'main_service' });
    expect(after.service.service_name).toBe('Pintura');
    expect(after.phase).toBe('main_service');
  });
});
