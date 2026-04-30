/**
 * Testa o contador de tentativas (`bumpErrorAttempt`/`getErrorAttempt`/
 * `resetErrorAttempt`) e a integração com `logWizardError`/`safeWizardSave`.
 *
 * Garantias:
 *  1. Bump incrementa de forma monotônica por (phase, action).
 *  2. Reset zera apenas o par (phase, action).
 *  3. logWizardError envia `attempt` e `action` na meta.
 *  4. safeWizardSave reseta o contador após sucesso.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  bumpErrorAttempt,
  getErrorAttempt,
  resetErrorAttempt,
  logWizardError,
  safeWizardSave,
} from '@/lib/wizardErrorGuard';

const trackMock = vi.fn();
vi.mock('@/components/onboarding/wizard/phases/v2/telemetry', () => ({
  trackOnboardingEvent: (...args: unknown[]) => trackMock(...args),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

beforeEach(() => {
  sessionStorage.clear();
  trackMock.mockClear();
});

describe('wizardErrorGuard — attempt counter', () => {
  it('bump incrementa monotônicamente por par phase:action', () => {
    expect(bumpErrorAttempt('phase1', 'submit')).toBe(1);
    expect(bumpErrorAttempt('phase1', 'submit')).toBe(2);
    expect(bumpErrorAttempt('phase1', 'submit')).toBe(3);
    expect(getErrorAttempt('phase1', 'submit')).toBe(3);
  });

  it('isola contador entre actions diferentes', () => {
    bumpErrorAttempt('phase1', 'submit');
    bumpErrorAttempt('phase1', 'submit');
    bumpErrorAttempt('phase1', 'validate');
    expect(getErrorAttempt('phase1', 'submit')).toBe(2);
    expect(getErrorAttempt('phase1', 'validate')).toBe(1);
  });

  it('reset zera apenas o par alvo', () => {
    bumpErrorAttempt('phase1', 'submit');
    bumpErrorAttempt('phase1', 'submit');
    bumpErrorAttempt('phase2', 'submit');
    resetErrorAttempt('phase1', 'submit');
    expect(getErrorAttempt('phase1', 'submit')).toBe(0);
    expect(getErrorAttempt('phase2', 'submit')).toBe(1);
  });

  it('logWizardError envia attempt e action na meta', () => {
    logWizardError({
      phase: 'phase2_service' as any,
      error: new Error('boom'),
      context: { action: 'create_service', service_id: 'abc' },
    });
    expect(trackMock).toHaveBeenCalledTimes(1);
    const call = trackMock.mock.calls[0][0];
    expect(call.event).toBe('error');
    expect(call.meta.attempt).toBe(1);
    expect(call.meta.action).toBe('create_service');
    expect(call.meta.message).toBe('boom');

    // segunda tentativa deve incrementar
    logWizardError({
      phase: 'phase2_service' as any,
      error: new Error('boom2'),
      context: { action: 'create_service' },
    });
    expect(trackMock.mock.calls[1][0].meta.attempt).toBe(2);
  });

  it('safeWizardSave reseta contador após sucesso', async () => {
    bumpErrorAttempt('phase3_done', 'finalize');
    bumpErrorAttempt('phase3_done', 'finalize');
    expect(getErrorAttempt('phase3_done', 'finalize')).toBe(2);

    const result = await safeWizardSave({
      phase: 'phase3_done' as any,
      context: { action: 'finalize' },
      fn: async () => 'ok',
    });
    expect(result.ok).toBe(true);
    expect(getErrorAttempt('phase3_done', 'finalize')).toBe(0);
  });

  it('safeWizardSave incrementa contador em erro', async () => {
    const result = await safeWizardSave({
      phase: 'phase3_done' as any,
      context: { action: 'finalize' },
      fn: async () => { throw new Error('db down'); },
    });
    expect(result.ok).toBe(false);
    expect(getErrorAttempt('phase3_done', 'finalize')).toBe(1);
    // log foi chamado com attempt=1
    expect(trackMock.mock.calls[0][0].meta.attempt).toBe(1);
  });
});
