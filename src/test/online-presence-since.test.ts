import { describe, it, expect } from 'vitest';
import { reducePresenceState, type PresenceState } from '@/hooks/useOnlinePresence';

/**
 * Regression: when the same provider appears in multiple presence
 * events (multi-tab, reconnect, presence drop+re-add), the earliest
 * `onlineSince` must always win — otherwise the "Conectado há Xm"
 * badge resets every time a presence sync happens.
 */
describe('useOnlinePresence — onlineSince merging', () => {
  const T0 = 1_700_000_000_000; // arbitrary base

  it('keeps the earliest onlineSince across multiple presences for the same user in one state', () => {
    const state: PresenceState = {
      providers: [
        { user_id: 'u1', city: 'SP', online_since: T0 + 5_000 },
        { user_id: 'u1', city: 'SP', online_since: T0 }, // earlier — should win
        { user_id: 'u1', city: 'SP', online_since: T0 + 10_000 },
      ],
    };
    const next = reducePresenceState(state, new Map(), T0 + 20_000);
    expect(next.get('u1')?.onlineSince).toBe(T0);
  });

  it('preserves the original onlineSince across successive sync events (drop + re-add)', () => {
    let map = new Map();

    map = reducePresenceState(
      { providers: [{ user_id: 'u1', online_since: T0 }] },
      map,
      T0,
    );
    expect(map.get('u1')?.onlineSince).toBe(T0);

    // Re-sync with a later online_since (e.g., presence dropped + reconnected) — earliest must win
    map = reducePresenceState(
      { providers: [{ user_id: 'u1', online_since: T0 + 60_000 }] },
      map,
      T0 + 60_000,
    );
    expect(map.get('u1')?.onlineSince).toBe(T0);

    // Many subsequent events keep the original timestamp
    for (let i = 1; i <= 5; i++) {
      map = reducePresenceState(
        { providers: [{ user_id: 'u1', online_since: T0 + i * 30_000 }] },
        map,
        T0 + i * 30_000,
      );
    }
    expect(map.get('u1')?.onlineSince).toBe(T0);
  });

  it('falls back to "now" when online_since is missing, but still merges with previous', () => {
    let map = reducePresenceState(
      { providers: [{ user_id: 'u1', online_since: T0 }] },
      new Map(),
      T0,
    );
    // Next event has no online_since — reducer should use `now` but still keep the earliest (T0)
    map = reducePresenceState(
      { providers: [{ user_id: 'u1' }] } as PresenceState,
      map,
      T0 + 120_000,
    );
    expect(map.get('u1')?.onlineSince).toBe(T0);
  });

  it('handles independent users without cross-contamination', () => {
    const state: PresenceState = {
      providers: [
        { user_id: 'u1', online_since: T0 },
        { user_id: 'u2', online_since: T0 + 50_000 },
        { user_id: 'u1', online_since: T0 + 30_000 }, // duplicate of u1
      ],
    };
    const next = reducePresenceState(state, new Map(), T0);
    expect(next.get('u1')?.onlineSince).toBe(T0);
    expect(next.get('u2')?.onlineSince).toBe(T0 + 50_000);
    expect(next.size).toBe(2);
  });

  it('removes users not present in the new state (so lastSeen logic can kick in)', () => {
    let map = reducePresenceState(
      {
        providers: [
          { user_id: 'u1', online_since: T0 },
          { user_id: 'u2', online_since: T0 },
        ],
      },
      new Map(),
      T0,
    );
    expect(map.size).toBe(2);

    // u2 disappears
    map = reducePresenceState(
      { providers: [{ user_id: 'u1', online_since: T0 + 10_000 }] },
      map,
      T0 + 10_000,
    );
    expect(map.has('u1')).toBe(true);
    expect(map.has('u2')).toBe(false);
    // u1's onlineSince stays anchored at T0
    expect(map.get('u1')?.onlineSince).toBe(T0);
  });
});
