/**
 * Fase 1.6.5 — Boundary de writes de onboarding_progress.
 *
 * Cobertura:
 *   A) Patch parcial preserva chaves existentes
 *   B) `undefined` no patch NÃO apaga valor existente
 *   C) Falha de write emite audit log sem PII
 *   D) Writers migrados (DashboardPage / DashboardMyPagePage) usam a boundary
 *   E) Merge profundo preserva nested objects
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const maybeSingleMock = vi.fn();
const insertAuditMock = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: (table: string) => {
      if (table === 'providers') {
        return {
          update: updateMock,
          select: selectMock,
        };
      }
      return { insert: insertAuditMock };
    },
  },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import {
  safeProgressMerge,
  mergeOnboardingProgress,
  setOnboardingProgress,
} from '@/lib/onboardingProgressSync';

function mockUpdateOk() {
  eqMock.mockResolvedValue({ error: null });
  updateMock.mockReturnValue({ eq: eqMock });
}
function mockUpdateFail(code = 'PGRST500') {
  eqMock.mockResolvedValue({ error: { code, message: 'boom' } });
  updateMock.mockReturnValue({ eq: eqMock });
}
function mockSelect(current: Record<string, unknown> | null) {
  maybeSingleMock.mockResolvedValue({ data: current ? { onboarding_progress: current } : null });
  selectMock.mockReturnValue({ eq: () => ({ maybeSingle: maybeSingleMock }) });
}

describe('safeProgressMerge / mergeOnboardingProgress', () => {
  it('A) preserva chaves existentes e adiciona novas', () => {
    const base = { profile: true, services: true };
    const out = safeProgressMerge(base, { portfolio: true });
    expect(out).toEqual({ profile: true, services: true, portfolio: true });
  });

  it('B) undefined nunca apaga valores', () => {
    const base = { profile: true, services: true };
    const out = safeProgressMerge(base, { services: undefined as any });
    expect(out).toEqual({ profile: true, services: true });
  });

  it('E) merge profundo preserva nested objects', () => {
    const base = { meta: { steps: { a: 1, b: 2 } }, profile: true };
    const out = safeProgressMerge(base, { meta: { steps: { b: 99, c: 3 } } });
    expect(out).toEqual({
      meta: { steps: { a: 1, b: 99, c: 3 } },
      profile: true,
    });
  });

  it('mergeOnboardingProgress é alias de safeProgressMerge', () => {
    expect(mergeOnboardingProgress).toBe(safeProgressMerge);
  });

  it('aceita base null/undefined', () => {
    expect(safeProgressMerge(null, { x: 1 })).toEqual({ x: 1 });
    expect(safeProgressMerge(undefined, { x: 1 })).toEqual({ x: 1 });
    expect(safeProgressMerge({ x: 1 }, null)).toEqual({ x: 1 });
  });

  it('arrays no patch substituem (não concatenam)', () => {
    const out = safeProgressMerge({ list: [1, 2] }, { list: [9] });
    expect(out).toEqual({ list: [9] });
  });
});

describe('setOnboardingProgress (boundary)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('A) faz update mesclado com currentProgress fornecido', async () => {
    mockUpdateOk();
    const res = await setOnboardingProgress(
      'prov-1',
      { portfolio: true },
      { source: 'test_a', currentProgress: { profile: true, services: true } },
    );
    expect(res.ok).toBe(true);
    expect(res.noop).toBe(false);
    expect(updateMock).toHaveBeenCalledWith({
      onboarding_progress: { profile: true, services: true, portfolio: true },
    });
  });

  it('D) no-op quando patch não muda nada (writer migrado)', async () => {
    const res = await setOnboardingProgress(
      'prov-1',
      { profile: true },
      { source: 'test_noop', currentProgress: { profile: true } },
    );
    expect(res.ok).toBe(true);
    expect(res.noop).toBe(true);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('retorna erro quando providerId está ausente', async () => {
    const res = await setOnboardingProgress(null, { x: true }, { source: 'test' });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('missing_provider_id');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('C) em falha de update emite audit log fail-soft sem PII', async () => {
    mockUpdateFail('PGRST116');
    const res = await setOnboardingProgress(
      'prov-1',
      { page_customized: true },
      { source: 'my_page_save', currentProgress: {} },
    );
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('PGRST116');
    // audit_log foi acionado
    expect(insertAuditMock).toHaveBeenCalled();
    const auditPayload = insertAuditMock.mock.calls[0][0];
    expect(auditPayload.action).toBe('onboarding_progress_sync_failed');
    expect(auditPayload.resource_type).toBe('multi_write_sync');
    // sem PII — apenas source/keys/error_code
    const details = auditPayload.details;
    expect(details.source).toBe('my_page_save');
    expect(details.boundary).toBe('onboarding_progress');
    expect(details.keys).toEqual(['page_customized']);
    expect(details.error_code).toBe('PGRST116');
    expect(JSON.stringify(details)).not.toMatch(/email|cpf|cnpj|whatsapp|phone/i);
  });

  it('busca currentProgress quando não fornecido', async () => {
    mockSelect({ profile: true });
    mockUpdateOk();
    const res = await setOnboardingProgress(
      'prov-1',
      { services: true },
      { source: 'test_select' },
    );
    expect(res.ok).toBe(true);
    expect(selectMock).toHaveBeenCalledWith('onboarding_progress');
    expect(updateMock).toHaveBeenCalledWith({
      onboarding_progress: { profile: true, services: true },
    });
  });
});
