import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Lightweight online-presence system using Supabase Realtime Presence.
 *
 * • usePresenceTracker(userId)  — call once in AuthProvider / App to announce
 *   that the current user is online.
 * • useOnlineProviders()        — returns Set<userId> of providers currently online.
 */

const CHANNEL_NAME = 'online-presence';

// ─── Singleton channel ───────────────────────────────────────────────
let channel: RealtimeChannel | null = null;
let onlineUsers = new Set<string>();
let listeners = new Set<() => void>();
let subscriberCount = 0;

function notify() {
  listeners.forEach((fn) => fn());
}

function syncPresenceState() {
  if (!channel) return;
  const state = channel.presenceState<{ user_id: string }>();
  const next = new Set<string>();
  for (const key in state) {
    for (const presence of state[key]) {
      if (presence.user_id) next.add(presence.user_id);
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
  onlineUsers = new Set();
  notify();
}

// ─── Hook: track current user as online ──────────────────────────────
export function usePresenceTracker(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const ch = ensureChannel();
    subscriberCount++;

    // Small delay so the channel is fully subscribed before tracking
    const timer = setTimeout(() => {
      ch.track({ user_id: userId });
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
  }, [userId]);
}

// ─── Hook: read online user set ──────────────────────────────────────
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

export function useOnlineProviders(): Set<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useIsProviderOnline(userId: string | undefined): boolean {
  const online = useOnlineProviders();
  return useMemo(() => !!userId && online.has(userId), [online, userId]);
}
