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
