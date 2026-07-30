/**
 * cross-tab diagnostics — buffer em memória (claim/heartbeat/TTL) usado
 * para diagnosticar conflitos reais sem depender do console.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  detectConcurrentTab,
  getCrossTabDiagnostics,
  startTabLeaderElection,
  __recordPeerPresence,
  __resetTabLeader,
} from '@/components/onboarding/wizard/phases/v2/crossTabSync';

const TAB_ID_KEY = 'onboarding_v2_tab_id';
const HEARTBEAT_KEY = 'onboarding_v2_active_tab';
const LEADER_KEY = 'wizard_tab_leader';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  __resetTabLeader();
  vi.useFakeTimers({ now: new Date('2026-07-24T12:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getCrossTabDiagnostics', () => {
  it('registra leader_claim no boot da aba única', () => {
    sessionStorage.setItem(TAB_ID_KEY, 'tab-A');
    const stop = startTabLeaderElection();
    const events = getCrossTabDiagnostics();
    expect(events.some((e) => e.kind === 'leader_claim' && e.tabId === 'tab-A')).toBe(true);
    stop();
  });

  it('registra heartbeat_write com ttlMs após intervalo (4s)', () => {
    sessionStorage.setItem(TAB_ID_KEY, 'tab-A');
    const stop = startTabLeaderElection();
    vi.advanceTimersByTime(4_000);
    const events = getCrossTabDiagnostics();
    const hb = events.find((e) => e.kind === 'heartbeat_write');
    expect(hb).toBeTruthy();
    expect(hb?.ttlMs).toBeGreaterThan(0);
    stop();
  });

  it('registra concurrent_dismissed com motivo no_leader_pair (aba única, heartbeat órfão)', () => {
    sessionStorage.setItem(TAB_ID_KEY, 'tab-A');
    localStorage.setItem(
      HEARTBEAT_KEY,
      JSON.stringify({ tabId: 'tab-antiga', updatedAt: Date.now() - 500 }),
    );
    expect(detectConcurrentTab()).toBe(false);
    const events = getCrossTabDiagnostics();
    const dismissed = events.find((e) => e.kind === 'concurrent_dismissed');
    expect(dismissed?.meta?.reason).toBe('no_leader_pair');
  });

  it('registra concurrent_detected com otherTabId quando há conflito real', () => {
    sessionStorage.setItem(TAB_ID_KEY, 'tab-A');
    localStorage.setItem(
      HEARTBEAT_KEY,
      JSON.stringify({ tabId: 'tab-B', updatedAt: Date.now() - 200 }),
    );
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: 'tab-B', ts: Date.now() }));
    __recordPeerPresence('tab-B');
    expect(detectConcurrentTab()).toBe(true);
    const events = getCrossTabDiagnostics();
    const conflict = events.find((e) => e.kind === 'concurrent_detected');
    expect(conflict?.meta?.otherTabId).toBe('tab-B');
    expect(conflict?.ttlMs).toBeGreaterThan(0);
  });

  it('buffer não excede 50 eventos (ring buffer)', () => {
    sessionStorage.setItem(TAB_ID_KEY, 'tab-A');
    const stop = startTabLeaderElection();
    // Avança 250s (62 ticks de 4s) — mais que capacidade do buffer.
    for (let i = 0; i < 62; i += 1) vi.advanceTimersByTime(4_000);
    expect(getCrossTabDiagnostics().length).toBeLessThanOrEqual(50);
    stop();
  });
});
