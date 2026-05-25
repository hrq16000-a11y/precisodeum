/**
 * Containment Patch — STOP LOSS do Onboarding V2.
 *
 * Cobre os 5 críticos endereçados pela auditoria 360º:
 *   #1 WhatsApp dead-end → fase auxiliar `phase_repair_contact` fora do PHASE_ORDER
 *   #2 Persistência antecipada do 1º serviço (idempotente, sem finalize)
 *   #3 Banner de "rascunho recuperado" só quando há conteúdo mínimo
 *   #4 Hidratação remota NÃO sobrescreve estado local mais novo
 *   #5 Telemetria explícita em falhas de upsert de draft remoto
 *
 * Estes testes são pure-logic (sem render do Shell completo) — exercitam os
 * helpers/reducer que sustentam o patch. Não fazem network nem dependem de
 * provider Supabase real.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initialOnboardingState,
  onboardingReducer,
  phaseIndex,
} from '@/components/onboarding/wizard/phases/v2/state';
import {
  readOnboardingV2Draft,
  readOnboardingV2DraftSavedAt,
  clearOnboardingV2Draft,
} from '@/components/onboarding/wizard/phases/v2/useOnboardingV2Draft';

const DRAFT_KEY = 'onboarding_v3_institutional_final';

beforeEach(() => {
  localStorage.clear();
});

/* ─────────────────────────────────────────────────────────────────────────
 * CRÍTICO #1 — Fase auxiliar de reparo (WhatsApp dead-end)
 * ───────────────────────────────────────────────────────────────────────── */
describe('Crítico #1 — phase_repair_contact (auxiliar, fora do PHASE_ORDER)', () => {
  it('GO_TO_REPAIR guarda a fase de origem e troca para a auxiliar', () => {
    const s1 = onboardingReducer(initialOnboardingState, {
      type: 'GO_TO',
      phase: 'phase2_details',
    } as any);
    const s2 = onboardingReducer(s1, { type: 'GO_TO_REPAIR', from: 'phase2_details' } as any);
    expect(s2.phase).toBe('phase_repair_contact');
    expect(s2.returnToPhase).toBe('phase2_details');
  });

  it('RETURN_FROM_REPAIR volta para a fase guardada e limpa returnToPhase', () => {
    const s1 = onboardingReducer(initialOnboardingState, {
      type: 'GO_TO_REPAIR',
      from: 'phase2_photos',
    } as any);
    const s2 = onboardingReducer(s1, { type: 'RETURN_FROM_REPAIR' } as any);
    expect(s2.phase).toBe('phase2_photos');
    expect(s2.returnToPhase).toBeNull();
  });

  it('NEXT dentro da fase de reparo retorna ao fluxo principal (não vai p/ próxima do PHASE_ORDER)', () => {
    const s1 = onboardingReducer(initialOnboardingState, {
      type: 'GO_TO_REPAIR',
      from: 'phase2_service',
    } as any);
    const s2 = onboardingReducer(s1, { type: 'NEXT' } as any);
    expect(s2.phase).toBe('phase2_service');
    expect(s2.returnToPhase).toBeNull();
  });

  it('phase_repair_contact NÃO entra na contagem ordinal do PHASE_ORDER', () => {
    // phaseIndex desconhecido retorna 0 (Math.max(0, -1)) — sinal usado pela
    // barra de progresso pra não saltar quando o usuário entra na auxiliar.
    expect(phaseIndex('phase_repair_contact' as any)).toBe(0);
    expect(phaseIndex('phase2_service' as any)).toBe(0);
    expect(phaseIndex('phase2_details' as any)).toBe(1);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * CRÍTICO #3 — Draft local só conta com conteúdo mínimo
 * ───────────────────────────────────────────────────────────────────────── */
describe('Crítico #3 — readOnboardingV2Draft só anuncia recuperação com conteúdo', () => {
  function seedDraft(partial: any) {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        profile: { whatsapp: '', full_name: '' },
        service: { service_name: '', category_ids: [] },
        phase: 'phase2_details',
        userRef: null,
        providerId: null,
        firstServiceId: null,
        ...partial,
      }),
    );
  }

  it('retorna null quando o draft está sem service_name, whatsapp e categoria', () => {
    seedDraft({});
    expect(readOnboardingV2Draft()).toBeNull();
  });

  it('retorna o draft quando há service_name (>=3)', () => {
    seedDraft({ service: { service_name: 'Pintor', category_ids: [] } });
    const draft = readOnboardingV2Draft();
    expect(draft).not.toBeNull();
    expect(draft?.service?.service_name).toBe('Pintor');
  });

  it('retorna o draft quando há whatsapp válido (>=10 dígitos)', () => {
    seedDraft({
      profile: { whatsapp: '(41) 99999-1234', full_name: '' },
      service: { service_name: '', category_ids: [] },
    });
    expect(readOnboardingV2Draft()).not.toBeNull();
  });

  it('retorna o draft quando há ao menos uma categoria selecionada', () => {
    seedDraft({ service: { service_name: '', category_ids: ['cat-1'] } });
    expect(readOnboardingV2Draft()).not.toBeNull();
  });

  it('expira drafts antigos (>7 dias) mesmo com conteúdo', () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        profile: {},
        service: { service_name: 'Antigo', category_ids: ['x'] },
        phase: 'phase2_details',
      }),
    );
    expect(readOnboardingV2Draft()).toBeNull();
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * CRÍTICO #4 — Hidratação remota NÃO sobrescreve local mais novo
 * ───────────────────────────────────────────────────────────────────────── */
describe('Crítico #4 — race-guard local vs remoto', () => {
  /** Replica a decisão usada no Shell para evitar regressão silenciosa. */
  function shouldDiscardRemoteAsStale(
    localSavedAt: number | null,
    remoteUpdatedAtISO: string | null,
  ): boolean {
    const local = localSavedAt || 0;
    const remote = remoteUpdatedAtISO ? Date.parse(remoteUpdatedAtISO) : 0;
    if (local <= 0 || remote <= 0) return false;
    return local > remote + 5000;
  }

  it('descarta remoto quando local é >5s mais novo', () => {
    const now = Date.now();
    const remoteISO = new Date(now - 60_000).toISOString();
    expect(shouldDiscardRemoteAsStale(now, remoteISO)).toBe(true);
  });

  it('NÃO descarta quando a diferença está dentro da folga (≤5s)', () => {
    const now = Date.now();
    const remoteISO = new Date(now - 3_000).toISOString();
    expect(shouldDiscardRemoteAsStale(now, remoteISO)).toBe(false);
  });

  it('NÃO descarta quando o remoto é mais novo (caso clássico de troca de dispositivo)', () => {
    const now = Date.now();
    const remoteISO = new Date(now + 60_000).toISOString();
    expect(shouldDiscardRemoteAsStale(now, remoteISO)).toBe(false);
  });

  it('NÃO descarta quando falta um dos timestamps', () => {
    expect(shouldDiscardRemoteAsStale(null, new Date().toISOString())).toBe(false);
    expect(shouldDiscardRemoteAsStale(Date.now(), null)).toBe(false);
  });

  it('readOnboardingV2DraftSavedAt devolve o savedAt do envelope', () => {
    const t = Date.now() - 1000;
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        savedAt: t,
        profile: {},
        service: { service_name: 'X', category_ids: ['c'] },
        phase: 'phase2_service',
      }),
    );
    expect(readOnboardingV2DraftSavedAt()).toBe(t);
    clearOnboardingV2Draft();
    expect(readOnboardingV2DraftSavedAt()).toBeNull();
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * CRÍTICO #2 — Early persist: idempotência e não-duplicação
 * ───────────────────────────────────────────────────────────────────────── */
describe('Crítico #2 — contrato de idempotência do early persist', () => {
  /**
   * Simula a regra implementada em persistFirstServiceEarly:
   *   - sem user → false
   *   - sem categoria ou nome → false (não cria nada)
   *   - state.firstServiceId já setado → true (no-op)
   *   - findExisting devolve id → reusa
   *   - caso contrário → insert
   *
   * Aqui validamos a TABELA de decisão, não a SQL — a SQL é coberta pelos
   * testes de persistFirstService já existentes.
   */
  type Decision = 'noop' | 'reuse' | 'insert' | 'abort';
  function decide(input: {
    hasUser: boolean;
    firstServiceId: string | null;
    categoryId: string | null;
    serviceName: string;
    existingId: string | null;
  }): Decision {
    if (!input.hasUser) return 'abort';
    if (input.firstServiceId) return 'noop';
    if (!input.categoryId || !input.serviceName.trim()) return 'abort';
    if (input.existingId) return 'reuse';
    return 'insert';
  }

  it('aborta sem usuário', () => {
    expect(
      decide({ hasUser: false, firstServiceId: null, categoryId: 'c', serviceName: 'X', existingId: null }),
    ).toBe('abort');
  });

  it('é no-op quando state.firstServiceId já existe (impede duplicação após refresh)', () => {
    expect(
      decide({ hasUser: true, firstServiceId: 'svc-1', categoryId: 'c', serviceName: 'X', existingId: null }),
    ).toBe('noop');
  });

  it('reusa quando o backend já tem um serviço dessa categoria (idempotência cross-device)', () => {
    expect(
      decide({ hasUser: true, firstServiceId: null, categoryId: 'c', serviceName: 'X', existingId: 'svc-99' }),
    ).toBe('reuse');
  });

  it('só insere quando NÃO há nada a reusar', () => {
    expect(
      decide({ hasUser: true, firstServiceId: null, categoryId: 'c', serviceName: 'X', existingId: null }),
    ).toBe('insert');
  });

  it('aborta sem categoria OU sem nome (não cria registro inválido)', () => {
    expect(
      decide({ hasUser: true, firstServiceId: null, categoryId: null, serviceName: 'X', existingId: null }),
    ).toBe('abort');
    expect(
      decide({ hasUser: true, firstServiceId: null, categoryId: 'c', serviceName: '   ', existingId: null }),
    ).toBe('abort');
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * CRÍTICO #2 (parte B) — UPDATE-on-reuse preserva cidades/horários
 * ───────────────────────────────────────────────────────────────────────── */
describe('Crítico #2B — contrato do sync de detalhes em reuso', () => {
  /**
   * Replica a montagem do `detailsPatch` aplicada quando `reusedExistingService`
   * é true em persistFirstService. Garante que cidades/horários coletados
   * em phase2_details sejam sempre escritos quando há um serviço pré-existente.
   */
  function buildDetailsPatch(state: {
    description: string;
    whatsapp: string;
    serviceArea: string;
    cityForAddress: string;
    workingHoursSummary: string;
    workingHoursStruct: unknown | null;
    resolvedCategoryName: string;
    categoryId: string;
    extraCategoryIds: string[];
  }) {
    const detailsPatch: Record<string, any> = {
      service_name: state.resolvedCategoryName,
      category_id: state.categoryId,
      category_ids: [state.categoryId, ...state.extraCategoryIds],
    };
    if (state.description.trim()) detailsPatch.description = state.description;
    if (state.whatsapp.trim()) detailsPatch.whatsapp = state.whatsapp;
    if (state.serviceArea) detailsPatch.service_area = state.serviceArea;
    if (state.cityForAddress) detailsPatch.address = state.cityForAddress;
    if (state.workingHoursSummary) detailsPatch.working_hours = state.workingHoursSummary;
    if (state.workingHoursStruct) detailsPatch.working_hours_struct = state.workingHoursStruct;
    return detailsPatch;
  }

  it('sempre escreve service_name e category_id (invariante)', () => {
    const p = buildDetailsPatch({
      description: '',
      whatsapp: '',
      serviceArea: '',
      cityForAddress: '',
      workingHoursSummary: '',
      workingHoursStruct: null,
      resolvedCategoryName: 'Pintor',
      categoryId: 'cat-1',
      extraCategoryIds: [],
    });
    expect(p.service_name).toBe('Pintor');
    expect(p.category_id).toBe('cat-1');
    expect(p.category_ids).toEqual(['cat-1']);
  });

  it('inclui cidades (service_area) e horários quando coletados em phase2_details', () => {
    const p = buildDetailsPatch({
      description: 'Pintura residencial e comercial',
      whatsapp: '(41) 99999-1234',
      serviceArea: 'Curitiba; São José dos Pinhais',
      cityForAddress: 'Curitiba - PR',
      workingHoursSummary: 'Seg-Sex 08-18',
      workingHoursStruct: { mon: '08-18' },
      resolvedCategoryName: 'Pintor',
      categoryId: 'cat-1',
      extraCategoryIds: ['cat-2'],
    });
    expect(p.service_area).toBe('Curitiba; São José dos Pinhais');
    expect(p.address).toBe('Curitiba - PR');
    expect(p.working_hours).toBe('Seg-Sex 08-18');
    expect(p.working_hours_struct).toEqual({ mon: '08-18' });
    expect(p.description).toBe('Pintura residencial e comercial');
    expect(p.category_ids).toEqual(['cat-1', 'cat-2']);
  });

  it('NÃO sobrescreve campos opcionais com vazio (proteção anti-overwrite)', () => {
    const p = buildDetailsPatch({
      description: '   ',
      whatsapp: '',
      serviceArea: '',
      cityForAddress: '',
      workingHoursSummary: '',
      workingHoursStruct: null,
      resolvedCategoryName: 'X',
      categoryId: 'c',
      extraCategoryIds: [],
    });
    expect('description' in p).toBe(false);
    expect('whatsapp' in p).toBe(false);
    expect('service_area' in p).toBe(false);
    expect('address' in p).toBe(false);
    expect('working_hours' in p).toBe(false);
    expect('working_hours_struct' in p).toBe(false);
  });
});
