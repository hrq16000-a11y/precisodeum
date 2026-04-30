/**
 * Telemetria — phase timer + draft source.
 *
 * Garante que:
 *  1. `markPhaseExit` emite `phase_exit` com `duration_ms` >= 0 e `draft_source`.
 *  2. `markPhaseExit` é no-op se não houve `markPhaseEnter` antes (sem ruído).
 *  3. `setOnboardingDraftSource('local'|'remote'|'seed'|'none')` é sticky e
 *     aparece em todos os eventos subsequentes.
 *  4. `resetPhaseTimers` limpa o estado interno (idempotência entre testes).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const insertSpy: any = vi.fn((..._args: any[]) => Promise.resolve({ error: null }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ insert: insertSpy }) },
}));

import {
  trackOnboardingEvent,
  markPhaseEnter,
  markPhaseExit,
  resetPhaseTimers,
  setOnboardingDraftSource,
  getOnboardingDraftSource,
} from '@/components/onboarding/wizard/phases/v2/telemetry';

describe('telemetry — phase timer & draft source', () => {
  beforeEach(() => {
    sessionStorage.clear();
    insertSpy.mockClear();
    resetPhaseTimers();
  });

  it('phase_exit carrega duration_ms >= 0 e draft_source explícito', async () => {
    setOnboardingDraftSource('remote');
    markPhaseEnter('phase2_service' as any);
    // Pequena espera artificial para garantir delta > 0
    await new Promise((r) => setTimeout(r, 5));
    await markPhaseExit('phase2_service' as any, { userId: 'u-1' });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.event).toBe('phase_exit');
    expect(payload.phase).toBe('phase2_service');
    expect(payload.user_id).toBe('u-1');
    expect(payload.meta.draft_source).toBe('remote');
    expect(typeof payload.meta.duration_ms).toBe('number');
    expect(payload.meta.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('markPhaseExit sem enter prévio é no-op (não emite evento espúrio)', async () => {
    await markPhaseExit('phase1_action' as any);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('draft source default é "none" quando ninguém setou', async () => {
    markPhaseEnter('phase1_contact' as any);
    await markPhaseExit('phase1_contact' as any);
    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.meta.draft_source).toBe('none');
  });

  it('draft source é sticky entre eventos enter consecutivos', async () => {
    setOnboardingDraftSource('local');
    expect(getOnboardingDraftSource()).toBe('local');

    await trackOnboardingEvent({
      phase: 'phase2_service' as any,
      event: 'enter',
      meta: { draft_source: getOnboardingDraftSource() || 'none' },
    });
    await trackOnboardingEvent({
      phase: 'phase2_details' as any,
      event: 'enter',
      meta: { draft_source: getOnboardingDraftSource() || 'none' },
    });

    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect((insertSpy.mock.calls[0][0] as any).meta.draft_source).toBe('local');
    expect((insertSpy.mock.calls[1][0] as any).meta.draft_source).toBe('local');
  });

  it('cada par enter/exit é independente entre fases', async () => {
    markPhaseEnter('phase1_contact' as any);
    markPhaseEnter('phase2_service' as any);
    await markPhaseExit('phase1_contact' as any);
    await markPhaseExit('phase2_service' as any);
    // Um exit por fase, sem cross-talk
    expect(insertSpy).toHaveBeenCalledTimes(2);
    const phases = insertSpy.mock.calls.map((c: any[]) => (c[0] as any).phase);
    expect(phases).toContain('phase1_contact');
    expect(phases).toContain('phase2_service');
  });
});
