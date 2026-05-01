/**
 * onboardingV2Reducer.test.ts — testes do reducer central do wizard V2.
 *
 * Cobre:
 *  - Skip end-to-end mantendo apenas Fase 1.4 e Fase 2.
 *  - Herança de categoria do serviço para o perfil ("Regra de Ouro da Memória").
 *  - Herança de horários do serviço para o perfil.
 *  - Persistência de phase em GO_TO/NEXT/SKIP_TO_NEXT.
 *  - Hidratação parcial via HYDRATE preserva resto do estado.
 *
 * Garantias anti-23502 estão cobertas em src/test/provider-payload-normalization.test.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  initialOnboardingState,
  onboardingReducer,
  phaseIndex,
  VISIBLE_PHASES_COUNT,
} from '@/components/onboarding/wizard/phases/v2/state';

describe('onboardingV2 reducer', () => {
  it('NEXT avança fase a fase até done (phase1_* removidas em mai/2026)', () => {
    let s = initialOnboardingState;
    const visited: string[] = [s.phase];
    for (let i = 0; i < VISIBLE_PHASES_COUNT; i++) {
      s = onboardingReducer(s, { type: 'NEXT' });
      visited.push(s.phase);
    }
    expect(s.phase).toBe('done');
    // phase1_* não existem mais — a 1ª fase viva é phase2_service.
    expect(visited[0]).toBe('phase2_service');
    expect(visited).toContain('phase2_service');
    expect(visited).toContain('phase2_photos');
    expect(visited).toContain('phase3_celebration');
  });

  it('SKIP_TO_NEXT avança como NEXT (skip = avançar nas fases não-críticas)', () => {
    const after = onboardingReducer(initialOnboardingState, { type: 'SKIP_TO_NEXT' });
    // Início agora é phase2_service → SKIP leva para phase2_details.
    expect(after.phase).toBe('phase2_details');
  });

  it('GO_TO permite voltar a uma fase anterior preservando dados', () => {
    let s = onboardingReducer(initialOnboardingState, {
      type: 'PATCH_PROFILE', patch: { full_name: 'Maria Silva', whatsapp: '41997452053' },
    });
    s = onboardingReducer(s, { type: 'GO_TO', phase: 'phase2_service' });
    expect(s.phase).toBe('phase2_service');
    expect(s.profile.full_name).toBe('Maria Silva');
    expect(s.profile.whatsapp).toBe('41997452053');
  });

  it('PATCH_PROFILE faz merge sem destruir campos existentes', () => {
    let s = onboardingReducer(initialOnboardingState, {
      type: 'PATCH_PROFILE', patch: { full_name: 'João' },
    });
    s = onboardingReducer(s, { type: 'PATCH_PROFILE', patch: { whatsapp: '11988887777' } });
    expect(s.profile.full_name).toBe('João');
    expect(s.profile.whatsapp).toBe('11988887777');
  });

  it('herança: categoria escolhida no serviço sobe para o perfil via PATCH_PROFILE', () => {
    // Esse comportamento é orquestrado pela UI — o reducer apenas garante
    // que ambos os patches coexistem no mesmo estado.
    let s = onboardingReducer(initialOnboardingState, {
      type: 'PATCH_SERVICE', patch: { category_ids: ['cat-eletricista'] },
    });
    s = onboardingReducer(s, {
      type: 'PATCH_PROFILE', patch: { primary_category_id: 'cat-eletricista' },
    });
    expect(s.service.category_ids).toEqual(['cat-eletricista']);
    expect(s.profile.primary_category_id).toBe('cat-eletricista');
  });

  it('herança: horário do serviço propaga para o perfil', () => {
    let s = onboardingReducer(initialOnboardingState, {
      type: 'PATCH_SERVICE', patch: { working_hours: 'Comercial (09h às 18h)' },
    });
    s = onboardingReducer(s, {
      type: 'PATCH_PROFILE', patch: { working_hours: 'Comercial (09h às 18h)' },
    });
    expect(s.service.working_hours).toBe('Comercial (09h às 18h)');
    expect(s.profile.working_hours).toBe('Comercial (09h às 18h)');
  });

  it('cenário "skip tudo exceto categoria do serviço": estado mínimo viável é preservado', () => {
    // phase1_* removidas — a triagem (Bet Mode) já entrega nome/WhatsApp/cidade.
    // Aqui simulamos só o V2: estado inicial = phase2_service.
    let s = initialOnboardingState;

    // Hidratamos os dados que viriam da triagem
    s = onboardingReducer(s, {
      type: 'PATCH_PROFILE',
      patch: { profile_type: 'provider', kind: 'pf', full_name: 'Ana Costa', whatsapp: '11999998888' },
    });

    // Fase 2.1: categoria + título
    s = onboardingReducer(s, {
      type: 'PATCH_SERVICE',
      patch: { category_ids: ['cat-1'], service_name: 'Diarista residencial' },
    });
    s = onboardingReducer(s, { type: 'PATCH_PROFILE', patch: { primary_category_id: 'cat-1' } });
    s = onboardingReducer(s, { type: 'NEXT' });

    // Fase 2.2: PULOU detalhes
    s = onboardingReducer(s, { type: 'SKIP_TO_NEXT' });

    // Conferimos: dados críticos persistidos, fase atual = phase2_photos
    expect(s.profile.full_name).toBe('Ana Costa');
    expect(s.profile.whatsapp).toBe('11999998888');
    expect(s.profile.primary_category_id).toBe('cat-1');
    expect(s.service.service_name).toBe('Diarista residencial');
    expect(s.phase).toBe('phase2_photos');
  });

  it('SET_PROVIDER_ID e SET_FIRST_SERVICE_ID guardam IDs sem alterar o resto', () => {
    let s = onboardingReducer(initialOnboardingState, {
      type: 'PATCH_PROFILE', patch: { full_name: 'X' },
    });
    s = onboardingReducer(s, { type: 'SET_PROVIDER_ID', id: 'prov-123' });
    s = onboardingReducer(s, { type: 'SET_FIRST_SERVICE_ID', id: 'svc-456' });
    expect(s.providerId).toBe('prov-123');
    expect(s.firstServiceId).toBe('svc-456');
    expect(s.profile.full_name).toBe('X');
  });

  it('HYDRATE faz merge profundo em profile/service', () => {
    const s = onboardingReducer(initialOnboardingState, {
      type: 'HYDRATE',
      state: {
        profile: { full_name: 'Pedro' } as any,
        service: { service_name: 'Pintura' } as any,
        phase: 'phase2_service',
      },
    });
    expect(s.profile.full_name).toBe('Pedro');
    expect(s.profile.kind).toBe('pf'); // preservado do default
    expect(s.service.service_name).toBe('Pintura');
    expect(s.service.category_ids).toEqual([]); // preservado do default
    expect(s.phase).toBe('phase2_service');
  });

  it('phaseIndex devolve posição na ordem do wizard (phase1_* removidas)', () => {
    // phase2_service é agora a primeira fase viva (índice 0).
    expect(phaseIndex('phase2_service')).toBe(0);
    expect(phaseIndex('phase2_photos')).toBeGreaterThan(phaseIndex('phase2_details'));
    expect(phaseIndex('done')).toBe(VISIBLE_PHASES_COUNT);
  });
});
