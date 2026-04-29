import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecentlyOfflineSet, useOnlineProviders, __presenceInternals } from '@/hooks/useOnlinePresence';

beforeEach(() => {
  __presenceInternals.reset();
  __presenceInternals.setHealth('healthy');
});

describe('Presence hooks — stable references for fewer re-renders', () => {
  it('useOnlineProviders returns the same Set reference across no-op syncs', () => {
    __presenceInternals.applyState({ providers: [{ user_id: 'u1', online_since: 1 }] }, 1);
    const { result, rerender } = renderHook(() => useOnlineProviders());
    const refA = result.current;

    // Same membership → same reference
    act(() => {
      __presenceInternals.applyState({ providers: [{ user_id: 'u1', online_since: 1 }] }, 2);
    });
    rerender();
    expect(result.current).toBe(refA);

    // Membership change → new reference
    act(() => {
      __presenceInternals.applyState({ providers: [{ user_id: 'u1' }, { user_id: 'u2' }] }, 3);
    });
    rerender();
    expect(result.current).not.toBe(refA);
  });

  it('useRecentlyOfflineSet returns stable Set ref while membership unchanged', () => {
    const start = Date.now();
    __presenceInternals.applyState({ providers: [{ user_id: 'u1' }] }, start);
    // u1 goes offline → enters recently-offline set
    act(() => {
      __presenceInternals.applyState({ providers: [] }, start + 1000);
    });

    const { result, rerender } = renderHook(() => useRecentlyOfflineSet(60_000));
    const refA = result.current;
    expect(refA.has('u1')).toBe(true);

    // Trigger another sync without membership change
    act(() => {
      __presenceInternals.applyState({ providers: [] }, start + 2000);
    });
    rerender();
    expect(result.current).toBe(refA);
  });
});
