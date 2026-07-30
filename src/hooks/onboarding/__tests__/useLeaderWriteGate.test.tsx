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
import { __recordPeerPresence, __resetTabLeader } from '@/components/onboarding/wizard/phases/v2/crossTabSync';
import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';

const TAB_ID_KEY = 'onboarding_v2_tab_id';
const HEARTBEAT_KEY = 'onboarding_v2_active_tab';
const LEADER_KEY = 'wizard_tab_leader';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  __resetTabLeader();
  (trackOnboardingEvent as any).mockClear();
  // jsdom pode reportar navigation.type='reload', o que faria
  // `detectConcurrentTab` cair no anti-falso-positivo. Neutralizamos.
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([]);
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

  it('detecta aba concorrente que escreve APÓS o boot (race window)', () => {
    // Simula: outra aba escreve seu heartbeat entre `startTabHeartbeat` e
    // `detectConcurrentTab` do hook. Para isso, aproveitamos que
    // `startTabHeartbeat` escreve nossa chave — depois substituímos por
    // uma chave "fresca" de outro tabId no instante entre os dois writes.
    //
    // Implementação: spy em `Storage.setItem` que, na PRIMEIRA escrita em
    // HEARTBEAT_KEY, adia via microtask uma sobreposição por outro tabId.
    const originalSet = Storage.prototype.setItem;
    let overwritten = false;
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, value: string) {
        originalSet.call(this, key, value);
        if (!overwritten && key === HEARTBEAT_KEY) {
          overwritten = true;
          // Simula outra aba escrevendo LOGO em seguida, dentro da mesma tick.
          originalSet.call(
            this,
            HEARTBEAT_KEY,
            JSON.stringify({ tabId: 'racing-tab', updatedAt: Date.now() }),
          );
          originalSet.call(this, LEADER_KEY, JSON.stringify({ tabId: 'racing-tab', ts: Date.now() }));
          __recordPeerPresence('racing-tab');
        }
      });

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

    spy.mockRestore();
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

  it('authSettled/profile atrasados NÃO reemitem telemetria nem re-registram leader', () => {
    let currentPhase = 'phase2_service';
    const getCurrentState = () => stateStub(currentPhase);
    const { rerender, unmount } = renderHook(
      (userId: string | undefined) => useLeaderWriteGate({ getCurrentState, userId }),
      { initialProps: undefined as string | undefined },
    );
    const initialLeaderTs = JSON.parse(localStorage.getItem(LEADER_KEY)!).ts;

    // authSettled tardio + mudança de fase → nenhuma nova telemetria,
    // nenhum re-claim de liderança (effect roda 1× por mount).
    currentPhase = 'phase2_details';
    rerender('user-late');
    rerender('user-late');
    expect(trackOnboardingEvent).not.toHaveBeenCalled();
    // ts pode ter sido renovado apenas pelo interval — não pelo re-render.
    const afterRerender = JSON.parse(localStorage.getItem(LEADER_KEY)!).ts;
    expect(afterRerender).toBe(initialLeaderTs);

    unmount();
  });
});
