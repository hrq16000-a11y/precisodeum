/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// ── Auto-clear ALL caches every 24 hours ──
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const CACHE_TS_KEY = 'sw-cache-born';

async function purgeAllCachesIfExpired() {
  try {
    const ts = await (await caches.open('sw-meta')).match(CACHE_TS_KEY);
    const born = ts ? Number(await ts.text()) : 0;
    const now = Date.now();
    if (born && now - born < CACHE_MAX_AGE_MS) return; // still fresh

    // Delete every cache except sw-meta
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== 'sw-meta').map(n => caches.delete(n)));

    // Reset timestamp
    const meta = await caches.open('sw-meta');
    await meta.put(CACHE_TS_KEY, new Response(String(now)));
  } catch (_) { /* silent */ }
}

// Run on activation and periodically
self.addEventListener('activate', (event) => {
  event.waitUntil(purgeAllCachesIfExpired());
});

// Check cache age on every fetch
self.addEventListener('fetch', () => {
  purgeAllCachesIfExpired();
});

// ── API: always network-first, short cache (5 min) ──
registerRoute(
  /^https:\/\/qaftogrqeyymewoofexc\.supabase\.co\/.*/i,
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })],
  })
);

// ── Fonts: network-first with 24h cache (not 1 year) ──
registerRoute(
  /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'fonts-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 86400 })],
  })
);

// ── Images: stale-while-revalidate, max 24h ──
registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
  new StaleWhileRevalidate({
    cacheName: 'images-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 })],
  })
);

// ── Push notifications ──
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  const title = payload.title || 'Atualizacao';
  const options: any = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-96.png',
    data: payload.data || { url: payload.url || '/' },
    actions: payload.actions || [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Fechar' },
    ],
    tag: payload.tag || 'pwa-notification',
    renotify: payload.renotify ?? false,
  };
  if (payload.image) {
    options.image = payload.image;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
