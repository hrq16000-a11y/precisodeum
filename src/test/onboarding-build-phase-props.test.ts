/**
 * buildPhaseProps — testes de contrato dos builders PUROS do shell V2.
 *
 * Garante:
 *  1) Saídas determinísticas: mesma entrada ⇒ mesmo objeto (snapshot).
 *  2) Sem side-effects: chamadas repetidas não acumulam estado, refs ou
 *     mutações nos inputs.
 *  3) Checklist coerente com o estado (categoria/nome/descrição/cidades/fotos).
 *  4) Diagnóstico de bloqueio do Phase2Photos cobre `no_session` vs `no_service`
 *     e lista os campos faltantes na ordem canônica.
 *
 * Estes testes blindam a fronteira UI-only entre o `OnboardingV2Shell` e o
 * registry `phaseComponentMap`: se algum builder começar a depender de hooks,
 * window, storage ou dispatch, o teste falha — empurrando o autor a mover o
 * código para um hook dedicado (regra do `buildPhaseProps.ts`).
 */
import { describe, it, expect } from 'vitest';
import {
  buildPhase2ServiceEncouragement,
  buildPhase2DetailsEncouragement,
  buildPhase2PhotosReadyEncouragement,
  buildPhase2PhotosBlockedDiagnostics,
} from '@/components/onboarding/v2/phases/buildPhaseProps';
import type {
  OnboardingProfileData,
  OnboardingFirstServiceData,
} from '@/components/onboarding/wizard/phases/v2/types';

const baseService = (over: Partial<OnboardingFirstServiceData> = {}): OnboardingFirstServiceData =>
  ({
    service_name: '',
    description: '',
    category_ids: [],
    cities_served: [],
    working_hours: '',
    ...over,
  }) as OnboardingFirstServiceData;

const baseProfile = (over: Partial<OnboardingProfileData> = {}): OnboardingProfileData =>
  ({
    full_name: '',
    city: '',
    state: '',
    primary_category_id: null,
    ...over,
  }) as OnboardingProfileData;

describe('buildPhase2ServiceEncouragement', () => {
  it('marca todos os passos como pendentes quando o serviço está vazio', () => {
    const copy = buildPhase2ServiceEncouragement(baseService(), 0);
    expect(copy.items.every((i) => i.done === false)).toBe(true);
    expect(copy.nextStep).toContain('categoria');
  });

  it('avança nextStep conforme campos são preenchidos', () => {
    const withCat = buildPhase2ServiceEncouragement(
      baseService({ category_ids: ['cat-1'] }),
      0,
    );
    expect(withCat.nextStep).toContain('nome');

    const withName = buildPhase2ServiceEncouragement(
      baseService({ category_ids: ['cat-1'], service_name: 'Pintura' }),
      0,
    );
    expect(withName.nextStep).toContain('descrição');

    const ready = buildPhase2ServiceEncouragement(
      baseService({
        category_ids: ['cat-1'],
        service_name: 'Pintura',
        description: 'Descrição longa o suficiente',
      }),
      0,
    );
    expect(ready.nextStep).toContain('salvar');
  });

  it('é puro: não muta os inputs nem retorna a mesma referência em chamadas distintas', () => {
    const service = baseService({ category_ids: ['c'] });
    const snapshot = JSON.stringify(service);
    const a = buildPhase2ServiceEncouragement(service, 0);
    const b = buildPhase2ServiceEncouragement(service, 0);
    expect(JSON.stringify(service)).toBe(snapshot);
    expect(a).not.toBe(b); // novo objeto
    expect(a).toEqual(b); // mesmo conteúdo
  });
});

describe('buildPhase2DetailsEncouragement', () => {
  it('considera fase incompleta sem cities_served', () => {
    const copy = buildPhase2DetailsEncouragement(
      baseService({ service_name: 'X', working_hours: '8-18' }),
      0,
    );
    const detalhes = copy.items.find((i) => i.label.startsWith('Detalhes'))!;
    expect(detalhes.done).toBe(false);
    expect(copy.nextStep).toContain('cidade');
  });

  it('marca completa quando há cidades + horários', () => {
    const copy = buildPhase2DetailsEncouragement(
      baseService({
        service_name: 'X',
        cities_served: ['Curitiba'],
        working_hours: '8-18',
      }),
      2,
    );
    const detalhes = copy.items.find((i) => i.label.startsWith('Detalhes'))!;
    expect(detalhes.done).toBe(true);
    expect(copy.nextStep).toContain('fotos');
  });
});

describe('buildPhase2PhotosReadyEncouragement', () => {
  it('tom "gentle" quando 0 fotos, "celebrate" quando >0', () => {
    expect(buildPhase2PhotosReadyEncouragement(baseService(), 0).tone).toBe('gentle');
    expect(buildPhase2PhotosReadyEncouragement(baseService(), 1).tone).toBe('celebrate');
  });

  it('renderiza contador X/5 no item de fotos', () => {
    const copy = buildPhase2PhotosReadyEncouragement(baseService(), 3);
    expect(copy.items.find((i) => i.label.includes('3/5'))).toBeTruthy();
  });
});

describe('buildPhase2PhotosBlockedDiagnostics', () => {
  it('reason=no_session quando hasUser=false e não lista campos', () => {
    const diag = buildPhase2PhotosBlockedDiagnostics({
      hasUser: false,
      service: baseService(),
      profile: baseProfile(),
    });
    expect(diag.reason).toBe('no_session');
    expect(diag.missing).toEqual([]);
    expect(diag.blockCode).toContain('no_session');
  });

  it('reason=no_service lista campos faltantes em ordem canônica', () => {
    const diag = buildPhase2PhotosBlockedDiagnostics({
      hasUser: true,
      service: baseService(),
      profile: baseProfile(),
    });
    expect(diag.reason).toBe('no_service');
    expect(diag.missing).toEqual([
      'categoria do serviço',
      'nome do serviço',
      'descrição (mínimo 10 caracteres)',
      'cidade',
    ]);
  });

  it('omite campos já preenchidos (categoria via profile.primary_category_id conta)', () => {
    const diag = buildPhase2PhotosBlockedDiagnostics({
      hasUser: true,
      service: baseService({ service_name: 'X', description: 'descrição longa' }),
      profile: baseProfile({ primary_category_id: 'cat-1', city: 'Curitiba' }),
    });
    expect(diag.missing).toEqual([]);
  });

  it('é puro: não muta os inputs', () => {
    const service = baseService({ service_name: 'X' });
    const profile = baseProfile({ city: 'Curitiba' });
    const snapS = JSON.stringify(service);
    const snapP = JSON.stringify(profile);
    buildPhase2PhotosBlockedDiagnostics({ hasUser: true, service, profile });
    expect(JSON.stringify(service)).toBe(snapS);
    expect(JSON.stringify(profile)).toBe(snapP);
  });
});
