import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const toUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const getDeviceType = () => (window.innerWidth < 768 ? 'mobile' : 'desktop');

const DEFAULT_TOPICS = ['noticias', 'vagas', 'servicos', 'promocoes'];

export type PwaNotificationTopic = (typeof DEFAULT_TOPICS)[number];

export interface NotificationPreferences {
  topics: PwaNotificationTopic[];
}

export const usePwaNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    topics: DEFAULT_TOPICS,
  });

  const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined
    || 'BJBCJSPWvkaiyO-pXRx36-kVcfS5LKtKEtQ_u5euZt241F6pVtDxN18Dc9tI0D26kwiIW8Run5M4TcAftb9paoI';
  const isSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

  const refreshStatus = useCallback(async () => {
    if (!isSupported) return;
    setPermission(Notification.permission);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
      setSubscription(null);
    }
  }, [isSupported]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return 'denied';
    const next = await Notification.requestPermission();
    setPermission(next);
    return next;
  }, [isSupported]);

  const upsertSubscription = useCallback(
    async (sub: PushSubscription, topics: PwaNotificationTopic[]) => {
      const json = sub.toJSON();
      await supabase.from('pwa_push_subscriptions' as any).upsert({
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        device_type: getDeviceType(),
        platform: navigator.platform,
        user_agent: navigator.userAgent,
        locale: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        topics,
        is_active: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'endpoint' });
    },
    []
  );

  const subscribe = useCallback(async (topics?: PwaNotificationTopic[]) => {
    if (!isSupported || !publicKey) return false;
    setIsLoading(true);
    try {
      const nextPermission = permission === 'default' ? await requestPermission() : permission;
      if (nextPermission !== 'granted') {
        setIsLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(publicKey),
      });
      const nextTopics = topics && topics.length > 0 ? topics : preferences.topics;
      await upsertSubscription(sub, nextTopics);
      setSubscription(sub);
      setIsSubscribed(true);
      setPreferences({ topics: nextTopics });
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, publicKey, permission, requestPermission, preferences.topics, upsertSubscription]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        const json = sub.toJSON();
        await sub.unsubscribe();
        await supabase
          .from('pwa_push_subscriptions' as any)
          .update({ is_active: false, updated_at: new Date().toISOString() } as any)
          .eq('endpoint', json.endpoint);
      }
      setSubscription(null);
      setIsSubscribed(false);
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const updateTopics = useCallback(async (topics: PwaNotificationTopic[]) => {
    setPreferences({ topics });
    if (!subscription) return;
    const json = subscription.toJSON();
    await supabase
      .from('pwa_push_subscriptions' as any)
      .update({ topics, updated_at: new Date().toISOString() } as any)
      .eq('endpoint', json.endpoint);
  }, [subscription]);

  const topicOptions = useMemo(() => DEFAULT_TOPICS, []);

  return {
    isSupported,
    publicKeyConfigured: Boolean(publicKey),
    permission,
    isSubscribed,
    subscription,
    isLoading,
    preferences,
    topicOptions,
    requestPermission,
    subscribe,
    unsubscribe,
    updateTopics,
    refreshStatus,
  };
};
