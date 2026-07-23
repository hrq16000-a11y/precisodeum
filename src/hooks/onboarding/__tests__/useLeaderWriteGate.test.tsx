/**
 * useLeaderWriteGate — integração com React + timers reais do hook.
 *
 * Verifica:
 *  - Aba única monta → vira líder após boot.
 *  - Detector de aba concorrente dispara telemetria one-shot.
 *  - Cleanup em unmount libera heartbeat + leader (sem vazar interval).
 *  - Remontagem preserva `tabId` (sessionStorage) e reassume liderança.
 *  - authSettled/profile atrasados NÃO afetam liderança (hook independe deles).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('@/components/onboarding/wizard/phases/v2/telemetry', () => ({
  trackOnboardingEvent: vi.fn(async () => {}),
}));

import { useLeaderWriteGate } from '@/hooks/onboarding/useLeaderWriteGate';
import { __resetTabLeader } from '@/components/onboarding/wizard/phases/v2/crossTabSync';
import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';

const TAB_ID_KEY = 'onboarding_v2_tab_id';
const HEARTBEAT_KEY = 'onboarding_v2_active_tab';
const LEADER_KEY = 'wizard_tab_leader';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  __resetTabLeader();
  (trackOnboardingEvent as any).mockClear();
  vi.useFakeTimers({ now: new Date('2026-07-23T12:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
});

function stateStub(phase = 'phase2_service') {
  return { phase } as any;
}

describe('useLeaderWriteGate', () => {
  it('aba única: monta e vira líder; SEM telemetria de concorrência', () => {
    const { result, unmount } = renderHook(() =>
      useLeaderWriteGate({ getCurrentState: () => stateStub(), userId: 'user-1' }),
    );

    // Boot: chave de líder escrita síncronamente pelo effect.
    const leader = JSON.parse(localStorage.getItem(LEADER_KEY)!);
    expect(leader.tabId).toBe(sessionStorage.getItem(TAB_ID_KEY));

    // Estado inicial reflete liderança imediata.
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.isLeader).toBe(true);
    expect(trackOnboardingEvent).not.toHaveBeenCalled();

    unmount();
    // Cleanup remove a chave de líder.
    expect(localStorage.getItem(LEADER_KEY)).toBeNull();
  });

  it('detecta aba concorrente pré-existente e emite telemetria one-shot', () => {
    // Simula outra aba com heartbeat fresco antes desta montar.
    localStorage.setItem(
      HEARTBEAT_KEY,
      JSON.stringify({ tabId: 'ghost-tab', updatedAt: Date.now() - 500 }),
    );
    localStorage.setItem(
      LEADER_KEY,
      JSON.stringify({ tabId: 'ghost-tab', ts: Date.now() - 500 }),
    );

    const { unmount } = renderHook(() =>
      useLeaderWriteGate({ getCurrentState: () => stateStub('phase2_details'), userId: 'user-1' }),
    );

    expect(trackOnboardingEvent).toHaveBeenCalledTimes(1);
    const call = (trackOnboardingEvent as any).mock.calls[0][0];
    expect(call).toMatchObject({
      event: 'error',
      phase: 'phase2_details',
      userId: 'user-1',
      meta: { kind: 'concurrent_tab_detected' },
    });

    unmount();
  });

  it('polling 5s reflete troca de liderança sem re-mount', () => {
    const { result, unmount } = renderHook(() =>
      useLeaderWriteGate({ getCurrentState: () => stateStub(), userId: 'user-1' }),
    );
    const myTabId = sessionStorage.getItem(TAB_ID_KEY)!;

    // Outra aba usurpa a chave (cenário hostil).
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: 'other-tab', ts: Date.now() }));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.isLeader).toBe(false);

    // Depois, a outra aba morre e esta reassume via heartbeat interno (4s).
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: myTabId, ts: Date.now() }));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.isLeader).toBe(true);

    unmount();
  });

  it('remontagem preserva tabId e reassume liderança', () => {
    const first = renderHook(() =>
      useLeaderWriteGate({ getCurrentState: () => stateStub(), userId: 'u' }),
    );
    const tabId = sessionStorage.getItem(TAB_ID_KEY);
    expect(tabId).toBeTruthy();
    first.unmount();
    expect(localStorage.getItem(LEADER_KEY)).toBeNull();
    // sessionStorage persiste entre remounts (equivalente a F5 na mesma aba).
    expect(sessionStorage.getItem(TAB_ID_KEY)).toBe(tabId);

    const second = renderHook(() =>
      useLeaderWriteGate({ getCurrentState: () => stateStub(), userId: 'u' }),
    );
    const leader = JSON.parse(localStorage.getItem(LEADER_KEY)!);
    expect(leader.tabId).toBe(tabId);
    second.unmount();
  });

  it('não vaza interval: após unmount, timers ficam ociosos', () => {
    const { unmount } = renderHook(() =>
      useLeaderWriteGate({ getCurrentState: () => stateStub(), userId: 'u' }),
    );
    unmount();
    // Nenhuma escrita nova deve ocorrer após cleanup.
    localStorage.removeItem(LEADER_KEY);
    localStorage.removeItem(HEARTBEAT_KEY);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(localStorage.getItem(LEADER_KEY)).toBeNull();
    expect(localStorage.getItem(HEARTBEAT_KEY)).toBeNull();
  });

  it('cenário auth atrasado: getCurrentState resolve a fase apenas quando telemetria dispara', () => {
    // Injeta concorrência para forçar disparo de telemetria.
    localStorage.setItem(
      HEARTBEAT_KEY,
      JSON.stringify({ tabId: 'other', updatedAt: Date.now() }),
    );
    localStorage.setItem(
      LEADER_KEY,
      JSON.stringify({ tabId: 'other', ts: Date.now() }),
    );

    let currentPhase = 'phase2_service';
    const getCurrentState = () => stateStub(currentPhase);
    // Simula usuário ainda não autenticado no boot.
    const { rerender, unmount } = renderHook(
      (userId: string | undefined) => useLeaderWriteGate({ getCurrentState, userId }),
      { initialProps: undefined as string | undefined },
    );

    expect(trackOnboardingEvent).toHaveBeenCalledTimes(1);
    const firstCall = (trackOnboardingEvent as any).mock.calls[0][0];
    expect(firstCall.userId).toBeUndefined();
    expect(firstCall.phase).toBe('phase2_service');

    // authSettled tardio: userId aparece; hook não re-emite telemetria.
    currentPhase = 'phase2_details';
    rerender('user-late');
    expect(trackOnboardingEvent).toHaveBeenCalledTimes(1);

    unmount();
  });
});
