import { describe, it, expect, beforeEach } from 'vitest';
import { __presenceInternals } from '@/hooks/useOnlinePresence';

/**
 * Verifies that `lastSeen` is correctly populated when a provider drops
 * out of the presence state, and remains accurate across multiple
 * subsequent presence sync events for other providers.
 */
describe('useOnlinePresence — lastSeen tracking', () => {
  const T0 = 1_700_000_000_000;

  beforeEach(() => {
    __presenceInternals.reset();
  });

  it('records lastSeen when a user disappears from the presence state', () => {
    __presenceInternals.applyState(
      { providers: [{ user_id: 'u1', online_since: T0 }] },
      T0,
    );
    expect(__presenceInternals.getLastSeenMap().has('u1')).toBe(false);

    // u1 disappears at T0 + 30s
    __presenceInternals.applyState({ providers: [] }, T0 + 30_000);
    expect(__presenceInternals.getOnlineMap().has('u1')).toBe(false);
    expect(__presenceInternals.getLastSeenMap().get('u1')).toBe(T0 + 30_000);
  });

  it('keeps lastSeen stable across subsequent unrelated sync events', () => {
    __presenceInternals.applyState(
      { providers: [{ user_id: 'u1', online_since: T0 }] },
      T0,
    );
    __presenceInternals.applyState({ providers: [] }, T0 + 60_000);
    const seen = __presenceInternals.getLastSeenMap().get('u1');
    expect(seen).toBe(T0 + 60_000);

    // Multiple later syncs (other users coming and going) must not move u1's lastSeen
    for (let i = 1; i <= 5; i++) {
      __presenceInternals.applyState(
        { providers: [{ user_id: `other${i}`, online_since: T0 + i * 10_000 }] },
        T0 + 60_000 + i * 10_000,
      );
    }
    expect(__presenceInternals.getLastSeenMap().get('u1')).toBe(T0 + 60_000);
  });

  it('updates lastSeen if a user reconnects and disconnects again', () => {
    __presenceInternals.applyState(
      { providers: [{ user_id: 'u1', online_since: T0 }] },
      T0,
    );
    __presenceInternals.applyState({ providers: [] }, T0 + 30_000);
    expect(__presenceInternals.getLastSeenMap().get('u1')).toBe(T0 + 30_000);

    // Reconnects after going fully offline → starts a fresh session
    __presenceInternals.applyState(
      { providers: [{ user_id: 'u1', online_since: T0 + 100_000 }] },
      T0 + 100_000,
    );
    expect(__presenceInternals.getOnlineMap().get('u1')?.onlineSince).toBe(T0 + 100_000);

    // Disconnects again later — lastSeen advances accordingly
    __presenceInternals.applyState({ providers: [] }, T0 + 200_000);
    expect(__presenceInternals.getLastSeenMap().get('u1')).toBe(T0 + 200_000);
  });

  it('handles many providers entering and leaving without cross-contamination of lastSeen', () => {
    __presenceInternals.applyState(
      {
        providers: [
          { user_id: 'a', online_since: T0 },
          { user_id: 'b', online_since: T0 },
          { user_id: 'c', online_since: T0 },
        ],
      },
      T0,
    );

    // a leaves at +10s, b leaves at +20s, c stays
    __presenceInternals.applyState(
      {
        providers: [
          { user_id: 'b', online_since: T0 },
          { user_id: 'c', online_since: T0 },
        ],
      },
      T0 + 10_000,
    );
    __presenceInternals.applyState(
      { providers: [{ user_id: 'c', online_since: T0 }] },
      T0 + 20_000,
    );

    expect(__presenceInternals.getLastSeenMap().get('a')).toBe(T0 + 10_000);
    expect(__presenceInternals.getLastSeenMap().get('b')).toBe(T0 + 20_000);
    expect(__presenceInternals.getLastSeenMap().has('c')).toBe(false);
    expect(__presenceInternals.getOnlineMap().get('c')?.onlineSince).toBe(T0);
  });

  it('after multiple sync events for the same provider, current onlineSince stays anchored to the earliest', () => {
    // Initial connect
    __presenceInternals.applyState(
      { providers: [{ user_id: 'u1', online_since: T0 }] },
      T0,
    );
    // 10 follow-up syncs with later timestamps (e.g., heartbeats / multi-tab)
    for (let i = 1; i <= 10; i++) {
      __presenceInternals.applyState(
        { providers: [{ user_id: 'u1', online_since: T0 + i * 5_000 }] },
        T0 + i * 5_000,
      );
    }
    expect(__presenceInternals.getOnlineMap().get('u1')?.onlineSince).toBe(T0);
  });
});
