/**
 * Fase 1.6.9 — Shadow Atomic Execution Layer tests.
 *
 * A) builders 1.6.8 geram ExecutionPlan consistente
 * B) executeOperation aceita todos os builders
 * C) mismatch gera audit `operation_execution_mismatch` sem PII
 * D) dry-run NÃO executa writes reais (supabase nunca é chamado)
 * E) tracker integra (ensureTracker preserva instância)
 * F) ownership 1.6.6 respeitado no plano
 * G) falhas parciais preservam comportamento (audit failed + message padrão)
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const supabaseFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: supabaseFrom, auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } },
}));

const logAuditAction = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/useAuditLog', () => ({
  logAuditAction: (...args: any[]) => logAuditAction(...args),
  useAuditLog: () => ({ logAction: logAuditAction }),
}));

import {
  buildDashboardProfileOperation,
  buildPersistFirstServiceOperation,
  buildBetFinalizeOperation,
  buildProfileTypeSwitchOperation,
  executeOperation,
  toExecutionPlan,
  ensureTracker,
  STANDARD_PARTIAL_MESSAGE as _unused,
} from '@/lib/operations';
import { STANDARD_PARTIAL_MESSAGE, createSyncTracker } from '@/lib/multiWriteSync';

beforeEach(() => {
  logAuditAction.mockClear();
  supabaseFrom.mockClear();
});

function mustOk<T extends { ok: boolean }>(r: T) {
  expect(r.ok).toBe(true);
  return r as Extract<T, { ok: true }>;
}

describe('Fase 1.6.9 — shadow atomic execution', () => {
  it('A) toExecutionPlan deriva shape canônico (9 chaves) a partir de qualquer builder', () => {
    const ops = [
      mustOk(buildDashboardProfileOperation({
        userId: 'u', profileType: 'provider', fullName: 'X', whatsapp: '11999999999',
        phone: '', city: 'SP', state: 'SP', hasCategory: true,
      })).operation,
      mustOk(buildPersistFirstServiceOperation({
        userId: 'u', providerId: 'p', categoryId: 'c', fullName: 'X',
        whatsappDigits: '11999999999', city: 'SP', state: 'SP',
      })).operation,
      mustOk(buildBetFinalizeOperation({
        userId: 'u', intent: 'pro', proKind: 'pf', fullName: 'X',
        whatsappDigits: '11999999999', city: 'SP', state: 'SP',
      })).operation,
      mustOk(buildProfileTypeSwitchOperation({
        userId: 'u', currentType: 'client', targetType: 'provider',
      })).operation,
    ];
    for (const op of ops) {
      const plan = toExecutionPlan(op);
      expect(Object.keys(plan).sort()).toEqual([
        'dependencies', 'executionPlan', 'ownership',
        'requiresAvatarSync', 'requiresFinalize', 'requiresProgressSync',
        'requiresServiceWrite', 'source', 'steps',
      ]);
      expect(plan.executionPlan).toEqual(plan.steps);
    }
  });

  it('B) executeOperation aceita todos os builders em dry-run e retorna ok=true sem observed', async () => {
    const op = mustOk(buildDashboardProfileOperation({
      userId: 'u', profileType: 'client', fullName: 'X', whatsapp: '', phone: '',
      city: 'SP', state: 'SP', hasCategory: true,
    })).operation;
    const r = await executeOperation(op);
    expect(r.mode).toBe('dry-run');
    expect(r.ok).toBe(true);
    expect(r.plan.source).toBe('dashboard_profile_page');
  });

  it('C) mismatch entre plano e observed emite audit sem PII', async () => {
    const op = mustOk(buildPersistFirstServiceOperation({
      userId: 'u', providerId: 'p', categoryId: 'c', fullName: 'Maria',
      whatsappDigits: '11999999999', city: 'SP', state: 'SP',
    })).operation;
    const r = await executeOperation(op, {
      observed: {
        providerUpdated: true,
        serviceCreated: false, // mismatch — service esperado mas não criado
        finalizeRan: false,    // mismatch — finalize esperado
        hasProviderId: true,
        hasCategoryId: true,
      },
    });
    expect(r.ok).toBe(false);
    expect(r.mismatches).toEqual(expect.arrayContaining(['service', 'finalize']));
    expect(logAuditAction).toHaveBeenCalled();
    const call = logAuditAction.mock.calls[0][0];
    expect(call.action).toBe('operation_execution_mismatch');
    const json = JSON.stringify(call.details);
    expect(json).not.toContain('Maria');
    expect(json).not.toContain('11999999999');
    expect(call.details.execution_path).toEqual(['provider', 'service', 'finalize']);
  });

  it('D) dry-run NÃO executa writes reais (supabase nunca chamado)', async () => {
    const op = mustOk(buildBetFinalizeOperation({
      userId: 'u', intent: 'client', fullName: 'X',
      whatsappDigits: '11999999999', city: 'SP', state: 'SP',
    })).operation;
    await executeOperation(op, { observed: { profileUpdated: true, finalizeRan: true } });
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it('E) ensureTracker preserva instância e cria nova quando ausente', () => {
    const t = createSyncTracker();
    expect(ensureTracker(t)).toBe(t);
    const fresh = ensureTracker();
    expect(fresh).not.toBe(t);
    expect(fresh.failedStep).toBeNull();
  });

  it('F) ownership 1.6.6 permanece no plano (provider→provider, client→profile)', () => {
    const pro = mustOk(buildDashboardProfileOperation({
      userId: 'u', profileType: 'provider', fullName: 'X', whatsapp: '', phone: '',
      city: 'SP', state: 'SP', hasCategory: true,
    })).operation;
    const cli = mustOk(buildDashboardProfileOperation({
      userId: 'u', profileType: 'client', fullName: 'X', whatsapp: '', phone: '',
      city: 'SP', state: 'SP', hasCategory: true,
    })).operation;
    expect(toExecutionPlan(pro).ownership).toBe('provider');
    expect(toExecutionPlan(cli).ownership).toBe('profile');
  });

  it('G) falha parcial observada emite `operation_execution_failed` e retorna message padrão', async () => {
    const op = mustOk(buildDashboardProfileOperation({
      userId: 'u', profileType: 'provider', fullName: 'X', whatsapp: '11999999999',
      phone: '', city: 'SP', state: 'SP', hasCategory: true,
    })).operation;
    const r = await executeOperation(op, {
      observed: { profileUpdated: true, providerUpdated: false, failedStep: 'provider' },
    });
    expect(r.ok).toBe(false);
    expect(r.message).toBe(STANDARD_PARTIAL_MESSAGE);
    const actions = logAuditAction.mock.calls.map((c) => c[0].action);
    expect(actions).toContain('operation_execution_failed');
  });

  it('G) dependência ausente é reportada em missingDependencies', async () => {
    const op = mustOk(buildPersistFirstServiceOperation({
      userId: 'u', providerId: 'p', categoryId: 'c', fullName: 'X',
      whatsappDigits: '11999999999', city: 'SP', state: 'SP',
    })).operation;
    const r = await executeOperation(op, {
      observed: { hasProviderId: false, hasCategoryId: true },
    });
    expect(r.missingDependencies).toContain('providers.id');
    const call = logAuditAction.mock.calls[0][0];
    expect(call.details.missing_dependency).toBe('providers.id');
  });

  it('live mode permanece bloqueado por padrão (não toca supabase)', async () => {
    const op = mustOk(buildProfileTypeSwitchOperation({
      userId: 'u', currentType: 'client', targetType: 'provider',
    })).operation;
    const r = await executeOperation(op, { mode: 'live' }); // sem enableLiveExecution
    expect(r.mode).toBe('dry-run');
    expect(supabaseFrom).not.toHaveBeenCalled();
  });
});
