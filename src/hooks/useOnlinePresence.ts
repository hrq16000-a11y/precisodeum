import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

const CHANNEL_NAME = 'online-presence';

let channel: RealtimeChannel | null = null;
let onlineUsers = new Map<string, { city?: string }>();
let listeners = new Set<() => void>();
let subscriberCount = 0;

function notify() {
  listeners.forEach((fn) => fn());
}

function syncPresenceState() {
  if (!channel) return;
  const state = channel.presenceState<{ user_id: string; city?: string }>();
  const next = new Map<string, { city?: string }>();
  for (const key in state) {
    for (const presence of state[key]) {
      if (presence.user_id) next.set(presence.user_id, { city: presence.city });
    }
  }
  onlineUsers = next;
  notify();
}

function ensureChannel() {
  if (channel) return channel;
  channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: 'providers' } },
  });

  channel
    .on('presence', { event: 'sync' }, syncPresenceState)
    .subscribe();

  return channel;
}

function destroyChannel() {
  if (!channel) return;
  supabase.removeChannel(channel);
  channel = null;
  onlineUsers = new Map();
  notify();
}

// ─── Hook: track current user as online ──────────────────────────────
export function usePresenceTracker(userId: string | undefined, meta?: { city?: string }) {
  useEffect(() => {
    if (!userId) return;

    const ch = ensureChannel();
    subscriberCount++;

    const timer = setTimeout(() => {
      ch.track({ user_id: userId, city: meta?.city });
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
  }, [userId, meta?.city]);
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

export function useOnlineUsersMap(): Map<string, { city?: string }> {
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
