import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

const CHANNEL_NAME = 'online-presence';

let channel: RealtimeChannel | null = null;
export type OnlinePresenceMeta = { city?: string; onlineSince?: number };
export type RawPresence = { user_id: string; city?: string; online_since?: number };
export type PresenceState = Record<string, RawPresence[]>;

let onlineUsers = new Map<string, OnlinePresenceMeta>();
/** Users who were recently online but are no longer present, with the timestamp they were last seen. */
let lastSeenMap = new Map<string, number>();
/** Wall-clock timestamp of the last presence sync — used for the "atualizado há Xs" label. */
let lastSyncAt = 0;
/** Realtime health: 'connecting' | 'healthy' | 'degraded' (Supabase Realtime offline / blocked) */
type RealtimeHealth = 'connecting' | 'healthy' | 'degraded';
let realtimeHealth: RealtimeHealth = 'connecting';
let listeners = new Set<() => void>();
let subscriberCount = 0;

/** If Supabase presence does not sync within this window, mark realtime as degraded. */
const REALTIME_HEALTH_TIMEOUT_MS = 12_000;
let healthTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

/**
 * Pure reducer: given a Supabase presence state and the previous
 * online-users map, returns the next online map.
 *
 * Exposed for unit testing — keeps the multi-event merge logic
 * isolated from React/Supabase.
 */
export function reducePresenceState(
  state: PresenceState,
  prev: Map<string, OnlinePresenceMeta>,
  now: number = Date.now(),
): Map<string, OnlinePresenceMeta> {
  const next = new Map<string, OnlinePresenceMeta>();
  for (const key in state) {
    for (const presence of state[key]) {
      if (!presence?.user_id) continue;
      const candidate = presence.online_since ?? now;
      // Earliest known onlineSince wins, across:
      //   1. multiple presences for the same user in the current state
      //   2. the previous map (presence drops + re-adds shouldn't reset the clock)
      const fromPrev = prev.get(presence.user_id)?.onlineSince;
      const fromCurrent = next.get(presence.user_id)?.onlineSince;
      const onlineSince = [fromPrev, fromCurrent, candidate]
        .filter((v): v is number => typeof v === 'number')
        .reduce((a, b) => Math.min(a, b));
      next.set(presence.user_id, {
        city: presence.city ?? next.get(presence.user_id)?.city,
        onlineSince,
      });
    }
  }
  return next;
}

function syncPresenceState() {
  if (!channel) return;
  const state = channel.presenceState<RawPresence>() as PresenceState;
  const now = Date.now();
  const next = reducePresenceState(state, onlineUsers, now);

  // Update lastSeen for users who dropped out of presence in this sync
  onlineUsers.forEach((_, userId) => {
    if (!next.has(userId)) lastSeenMap.set(userId, now);
  });

  onlineUsers = next;
  lastSyncAt = now;
  if (realtimeHealth !== 'healthy') {
    realtimeHealth = 'healthy';
  }
  resetHealthTimer();
  notify();
}

function resetHealthTimer() {
  if (healthTimer) clearTimeout(healthTimer);
  healthTimer = setTimeout(() => {
    // No sync for too long → mark as degraded so UI can fallback gracefully
    if (realtimeHealth !== 'degraded') {
      realtimeHealth = 'degraded';
      notify();
    }
  }, REALTIME_HEALTH_TIMEOUT_MS);
}

function ensureChannel() {
  if (channel) return channel;
  realtimeHealth = 'connecting';
  resetHealthTimer();
  channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: 'providers' } },
  });

  channel
    .on('presence', { event: 'sync' }, syncPresenceState)
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        realtimeHealth = 'degraded';
        notify();
      }
    });

  return channel;
}

function destroyChannel() {
  if (!channel) return;
  supabase.removeChannel(channel);
  channel = null;
  onlineUsers = new Map();
  if (healthTimer) { clearTimeout(healthTimer); healthTimer = null; }
  realtimeHealth = 'connecting';
  // Keep lastSeenMap so badges can still show "esteve online há Xm" briefly
  notify();
}

// ─── Visibility preference (per-user, persisted in localStorage) ─────
const VISIBILITY_KEY = 'presence_visibility';
const VISIBILITY_EVENT = 'presence-visibility-changed';

export function getPresenceVisibility(userId: string | undefined): boolean {
  if (!userId || typeof localStorage === 'undefined') return true;
  const v = localStorage.getItem(`${VISIBILITY_KEY}_${userId}`);
  return v === null ? true : v === '1';
}

export function setPresenceVisibility(userId: string, online: boolean) {
  localStorage.setItem(`${VISIBILITY_KEY}_${userId}`, online ? '1' : '0');
  window.dispatchEvent(new CustomEvent(VISIBILITY_EVENT, { detail: { userId, online } }));
}

export function usePresenceVisibility(userId: string | undefined): [boolean, (v: boolean) => void] {
  const [visible, setVisible] = useState<boolean>(() => getPresenceVisibility(userId));

  useEffect(() => {
    setVisible(getPresenceVisibility(userId));
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { userId: string; online: boolean };
      if (detail?.userId === userId) setVisible(detail.online);
    };
    window.addEventListener(VISIBILITY_EVENT, handler);
    return () => window.removeEventListener(VISIBILITY_EVENT, handler);
  }, [userId]);

  const toggle = useCallback((v: boolean) => {
    if (!userId) return;
    setPresenceVisibility(userId, v);
  }, [userId]);

  return [visible, toggle];
}

// ─── Hook: track current user as online (respeita preferência) ───────
export function usePresenceTracker(userId: string | undefined, meta?: { city?: string }) {
  const [visible] = usePresenceVisibility(userId);

  useEffect(() => {
    if (!userId || !visible) return;

    const ch = ensureChannel();
    subscriberCount++;

    const timer = setTimeout(() => {
      ch.track({ user_id: userId, city: meta?.city, online_since: Date.now() });
    }, 500);

    return () => {
      clearTimeout(timer);
      subscriberCount--;
      ch.untrack();
      if (subscriberCount <= 0) {
        subscriberCount = 0;
        destroyChannel();
      }
    };
  }, [userId, visible, meta?.city]);
}

// ─── Hook: read online user map ──────────────────────────────────────
function subscribe(cb: () => void) {
  listeners.add(cb);
  subscriberCount++;
  ensureChannel();
  return () => {
    listeners.delete(cb);
    subscriberCount--;
    if (subscriberCount <= 0) {
      subscriberCount = 0;
      destroyChannel();
    }
  };
}

function getSnapshot() {
  return onlineUsers;
}

export function useOnlineUsersMap(): Map<string, OnlinePresenceMeta> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Legacy: returns Set<userId> for backward compat */
export function useOnlineProviders(): Set<string> {
  const map = useOnlineUsersMap();
  return useMemo(() => new Set(map.keys()), [map]);
}

export function useIsProviderOnline(userId: string | undefined): boolean {
  const map = useOnlineUsersMap();
  return useMemo(() => !!userId && map.has(userId), [map, userId]);
}

/** Returns presence meta (including onlineSince timestamp) for a single provider */
export function useProviderPresence(userId: string | undefined): OnlinePresenceMeta | null {
  const map = useOnlineUsersMap();
  return useMemo(() => (userId ? map.get(userId) ?? null : null), [map, userId]);
}

/** Returns the last time a provider was seen online (after they go offline). */
export function useProviderLastSeen(userId: string | undefined): number | null {
  // Subscribe to the same store so this re-runs on presence changes
  useOnlineUsersMap();
  if (!userId) return null;
  // If currently online, return their onlineSince via the live map
  if (onlineUsers.has(userId)) return null;
  return lastSeenMap.get(userId) ?? null;
}

/** Returns the wall-clock timestamp of the last presence sync. */
export function useLastPresenceSync(): number {
  useOnlineUsersMap();
  return lastSyncAt;
}

/** Default window after which a user is no longer considered "recently offline". */
export const RECENTLY_OFFLINE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/** Returns the realtime channel health, so UI can fallback when Supabase Realtime is down. */
export function useRealtimeHealth(): RealtimeHealth {
  useOnlineUsersMap();
  return realtimeHealth;
}

/** Returns true if the user went offline within the given window (default 10min). */
export function useIsRecentlyOffline(
  userId: string | undefined,
  windowMs: number = RECENTLY_OFFLINE_WINDOW_MS,
): boolean {
  useOnlineUsersMap();
  if (!userId) return false;
  if (onlineUsers.has(userId)) return false;
  const seen = lastSeenMap.get(userId);
  if (!seen) return false;
  return Date.now() - seen <= windowMs;
}

/**
 * Returns the set of users that went offline within the given window.
 *
 * Optimization: returns the same Set reference when the membership did not
 * change (structural equality check), so consumers wrapped in useMemo /
 * useCallback don't re-render on every Realtime presence sync.
 */
let recentlyOfflineCache: { windowMs: number; set: Set<string> } | null = null;

function computeRecentlyOfflineSet(windowMs: number): Set<string> {
  const now = Date.now();
  const next = new Set<string>();
  lastSeenMap.forEach((seen, userId) => {
    if (!onlineUsers.has(userId) && now - seen <= windowMs) next.add(userId);
  });
  // Reuse previous reference if membership is identical
  if (
    recentlyOfflineCache &&
    recentlyOfflineCache.windowMs === windowMs &&
    recentlyOfflineCache.set.size === next.size
  ) {
    let identical = true;
    for (const id of next) {
      if (!recentlyOfflineCache.set.has(id)) { identical = false; break; }
    }
    if (identical) return recentlyOfflineCache.set;
  }
  recentlyOfflineCache = { windowMs, set: next };
  return next;
}

export function useRecentlyOfflineSet(windowMs: number = RECENTLY_OFFLINE_WINDOW_MS): Set<string> {
  useOnlineUsersMap();
  // Recompute on every render is cheap (single Map walk) but the returned
  // Set ref is stable across syncs that don't change membership.
  return computeRecentlyOfflineSet(windowMs);
}

/** Count online users in a specific city */
export function useOnlineCountByCity(city: string | null): number {
  const map = useOnlineUsersMap();
  return useMemo(() => {
    if (!city) return map.size;
    const normalized = city.toLowerCase();
    let count = 0;
    map.forEach((v) => {
      if (v.city?.toLowerCase() === normalized) count++;
    });
    return count;
  }, [map, city]);
}

// ─── Test helpers ────────────────────────────────────────────────────
/** @internal — exposed only for unit tests */
export const __presenceInternals = {
  reset() {
    onlineUsers = new Map();
    lastSeenMap = new Map();
    lastSyncAt = 0;
    realtimeHealth = 'connecting';
  },
  applyState(state: PresenceState, now: number = Date.now()) {
    const next = reducePresenceState(state, onlineUsers, now);
    onlineUsers.forEach((_, userId) => {
      if (!next.has(userId)) lastSeenMap.set(userId, now);
    });
    onlineUsers = next;
    lastSyncAt = now;
    realtimeHealth = 'healthy';
    notify();
  },
  setHealth(h: RealtimeHealth) { realtimeHealth = h; notify(); },
  getOnlineMap: () => onlineUsers,
  getLastSeenMap: () => lastSeenMap,
  getHealth: () => realtimeHealth,
};
