/**
 * Testes para o detector de timer zumbi do wizard.
 *
 * Garantias:
 *  1. Timer disparado SEM troca de fase executa o callback normalmente.
 *  2. Timer disparado APÓS `setActiveWizardPhase` mudar emite evento
 *     `error` com `error_code: 'zombie_timer'` e NÃO executa o callback
 *     (default conservador).
 *  3. Meta inclui `phase_at_schedule`, `phase_at_fire`, `delay_ms`, `action`.
 *  4. `runIfStale: true` faz o callback rodar mesmo após troca de fase
 *     (mas ainda registra a detecção).
 *  5. `clearTimeout` no handle retornado cancela o agendamento.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  scheduleWizardTimeout,
  setActiveWizardPhase,
  __resetWizardZombieGuard,
} from '@/lib/wizardZombieGuard';

const trackMock = vi.fn();
vi.mock('@/components/onboarding/wizard/phases/v2/telemetry', () => ({
  trackOnboardingEvent: (...args: unknown[]) => trackMock(...args),
}));

beforeEach(() => {
  vi.useFakeTimers();
  trackMock.mockClear();
  __resetWizardZombieGuard();
});

describe('wizardZombieGuard.scheduleWizardTimeout', () => {
  it('executa callback normalmente quando a fase não mudou', () => {
    setActiveWizardPhase('phase1_action');
    const fn = vi.fn();
    scheduleWizardTimeout({ phase: 'phase1_action', action: 'noop' }, fn, 100);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('detecta timer zumbi: NÃO executa fn e registra error_code=zombie_timer', () => {
    setActiveWizardPhase('phase1_action');
    const fn = vi.fn();
    scheduleWizardTimeout(
      { phase: 'phase1_action', action: 'transition_next' },
      fn,
      200,
    );
    // Usuário troca de fase antes do timer disparar
    setActiveWizardPhase('phase2_service');
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledTimes(1);
    const payload = trackMock.mock.calls[0][0];
    expect(payload.event).toBe('error');
    expect(payload.meta.error_code).toBe('zombie_timer');
    expect(payload.meta.action).toBe('transition_next');
    expect(payload.meta.phase_at_schedule).toBe('phase1_action');
    expect(payload.meta.phase_at_fire).toBe('phase2_service');
    expect(payload.meta.delay_ms).toBe(200);
  });

  it('runIfStale=true ainda executa o callback mas registra a detecção', () => {
    setActiveWizardPhase('phase1_action');
    const fn = vi.fn();
    scheduleWizardTimeout(
      { phase: 'phase1_action', action: 'soft', runIfStale: true },
      fn,
      50,
    );
    setActiveWizardPhase('phase2_service');
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock.mock.calls[0][0].meta.error_code).toBe('zombie_timer');
  });

  it('clearTimeout no handle retornado cancela o agendamento', () => {
    setActiveWizardPhase('phase1_action');
    const fn = vi.fn();
    const handle = scheduleWizardTimeout({ action: 'cancel' }, fn, 100);
    window.clearTimeout(handle);
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('setActiveWizardPhase ignora chamada redundante (mesma fase)', () => {
    setActiveWizardPhase('phase1_action');
    const fn = vi.fn();
    scheduleWizardTimeout({ action: 'redundant' }, fn, 100);
    // Re-chamar com a mesma fase NÃO incrementa épocas — não deve gerar zombie
    setActiveWizardPhase('phase1_action');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(trackMock).not.toHaveBeenCalled();
  });
});
