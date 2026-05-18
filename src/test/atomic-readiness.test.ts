/**
 * Fase 1.7.0 — Atomic Readiness Audit + Live Execution Gate.
 *
 * A) live mode bloqueado por padrão
 * B) registry cobre os 9 fluxos esperados
 * C) detectUnsafeWrites encontra writes fora da boundary
 * D) READY/PARTIAL/BLOCKED classificados corretamente
 * E) telemetria sem PII
 * F) gate impossível de ativar sem flag explícita
 * G) builder/registry consistência (sem mismatch silencioso)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const logAuditAction = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/useAuditLog', () => ({
  logAuditAction: (...a: any[]) => logAuditAction(...a),
  useAuditLog: () => ({ logAction: logAuditAction }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } },
}));

import {
  isLiveExecutionEnabled,
  assertLiveExecutionAllowed,
  getExecutionMode,
  explainExecutionMode,
  setLiveExecutionOverride,
  OPERATION_REGISTRY,
  getAtomicReadiness,
  getFlowRegistration,
  detectUnsafeWrites,
  type FlowId,
} from '@/lib/operations';

beforeEach(() => logAuditAction.mockClear());
afterEach(() => setLiveExecutionOverride(null));

describe('Fase 1.7.0 — atomic readiness', () => {
  it('A) live mode bloqueado por padrão (dry-run)', () => {
    expect(isLiveExecutionEnabled()).toBe(false);
    expect(getExecutionMode()).toBe('dry-run');
  });

  it('A) assertLiveExecutionAllowed retorna false e audita quando gate fechado', async () => {
    const ok = await assertLiveExecutionAllowed({ source: 'test', flow: 'dashboard_profile_save', boundary: 'multiWriteSync' });
    expect(ok).toBe(false);
    expect(logAuditAction).toHaveBeenCalledTimes(1);
    const call = logAuditAction.mock.calls[0][0];
    expect(call.action).toBe('live_execution_blocked');
    expect(call.details.flow).toBe('dashboard_profile_save');
    expect(call.details.execution_mode).toBe('dry-run');
    expect(typeof call.details.reason).toBe('string');
  });

  it('B) registry contém todos os 9 fluxos esperados', () => {
    const expected: FlowId[] = [
      'dashboard_profile_save', 'persist_first_service',
      'bet_finish_client', 'bet_finish_pro',
      'profile_type_switch', 'avatar_sync',
      'onboarding_progress_sync', 'admin_profile_update', 'admin_provider_update',
    ];
    expect(OPERATION_REGISTRY.map((r) => r.flow).sort()).toEqual(expected.sort());
    for (const f of expected) expect(getFlowRegistration(f)).toBeDefined();
  });

  it('C) detectUnsafeWrites identifica write fora da boundary', () => {
    const r = detectUnsafeWrites({
      files: {
        'src/pages/EvilPage.tsx': `await supabase.from('profiles').update({ x: 1 }).eq('id', '1');`,
        'src/lib/avatarSync.ts': `await supabase.from('profiles').update({ avatar_url: u }).eq('id', x);`,
        'src/pages/AdminPage.tsx': `await supabase.from('profiles').update({ y: 2 }).eq('id', '1');`,
        'src/test/foo.test.ts': `await supabase.from('profiles').update({ x: 1 });`,
      },
    });
    expect(r.summary.UNSAFE).toBe(1);
    expect(r.summary.SAFE).toBe(1);
    expect(r.summary.LEGACY).toBe(1);
    const evil = r.hits.find((h) => h.file === 'src/pages/EvilPage.tsx')!;
    expect(evil.severity).toBe('UNSAFE');
    expect(evil.table).toBe('profiles');
    expect(evil.operation).toBe('update');
    expect(r.hits.find((h) => h.file.includes('test'))).toBeUndefined();
  });

  it('C) detectUnsafeWrites respeita allowlist por comentário', () => {
    const r = detectUnsafeWrites({
      files: {
        'src/pages/Allowed.tsx': `// boundary-allowlist: migration script\nawait supabase.from('x').insert({});`,
      },
    });
    expect(r.summary.UNSAFE).toBe(0);
  });

  it('D) READY/PARTIAL/BLOCKED classificados corretamente', () => {
    const s = getAtomicReadiness();
    expect(s.total).toBe(9);
    expect(s.ready).toContain('dashboard_profile_save');
    expect(s.partial).toContain('persist_first_service');
    expect(s.partial).toContain('bet_finish_pro');
    expect(s.blocked).toEqual([]);
    expect(s.coveragePct).toBeGreaterThan(0);
    expect(s.coveragePct).toBeLessThanOrEqual(100);
  });

  it('E) telemetria nunca expõe PII', async () => {
    await assertLiveExecutionAllowed({ source: 'src_test', flow: 'bet_finish_pro' });
    const json = JSON.stringify(logAuditAction.mock.calls[0][0]);
    expect(json).not.toMatch(/@/); // sem emails
    expect(json).not.toMatch(/\b\d{11}\b/); // sem CPF
    expect(json).not.toMatch(/\b55\d{10,11}\b/); // sem whatsapp
  });

  it('F) gate só liga via override explícito (impossível por acidente)', async () => {
    expect(isLiveExecutionEnabled()).toBe(false);
    setLiveExecutionOverride(true);
    expect(isLiveExecutionEnabled()).toBe(true);
    expect(getExecutionMode()).toBe('live');
    const ok = await assertLiveExecutionAllowed({ source: 'test' });
    expect(ok).toBe(true);
    setLiveExecutionOverride(false);
    expect(isLiveExecutionEnabled()).toBe(false);
    const explanation = explainExecutionMode();
    expect(explanation.mode).toBe('dry-run');
    expect(explanation.reason).toBe('programmatic_override_blocked');
  });

  it('G) registry alinhado com builders (sem mismatch silencioso)', () => {
    for (const r of OPERATION_REGISTRY) {
      // requiresProgressSync só faz sentido quando há provider step
      if (r.requiresProgressSync) expect(r.steps).toContain('provider');
      // requiresAvatarSync exige passo avatar
      if (r.requiresAvatarSync) expect(r.steps).toContain('avatar');
      // requiresFinalize exige passo finalize
      if (r.requiresFinalize) expect(r.steps).toContain('finalize');
      // boundaries oficiais reconhecidas
      expect(['multiWriteSync', 'avatarSync', 'onboardingProgressSync', 'adminWriteBoundary', 'inline_call_site'])
        .toContain(r.boundary);
    }
  });
});
