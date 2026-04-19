// ─── Preciso de um — Service Worker v4 ───
// Estratégia segura para SPA com bundles versionados (Vite hash):
//  - NUNCA cacheia /assets/*-{hash}.{js,css} (deixa Cache-Control HTTP gerenciar)
//  - Navigation: network-first → fallback HTML cacheado → fallback offline.html
//  - Imagens/fontes: stale-while-revalidate
//  - Bump de versão (v3→v4) força limpeza dos caches corrompidos em clientes existentes
const CACHE_NAME = 'pwa-v4';
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
];

// Detecta bundle versionado do Vite (ex: /assets/index-9EjBEZ4G.js)
const HASHED_ASSET_RE = /\/assets\/.+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf|otf)$/;

// ── Install ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: limpa caches antigos ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Bypass total para chamadas cross-origin (Supabase, fontes, APIs externas)
  if (url.origin !== self.location.origin) return;

  // Bypass total para bundles hash (imutáveis — HTTP cache cuida)
  // Isso é o que evita "tela branca após deploy"
  if (HASHED_ASSET_RE.test(url.pathname)) return;

  // Navegação SPA: network-first → cache do "/" → offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('/')) || (await cache.match(OFFLINE_URL));
        })
    );
    return;
  }

  // Imagens e fontes não-versionadas: stale-while-revalidate
  if (request.destination === 'image' || request.destination === 'font') {
    // Suporta também imagens cross-origin (Supabase Storage, GCS) cacheando localmente
  }
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetched;
      })
    );
    return;
  }

  // Demais requests: passa direto pra rede
});

// ── Push notifications ──
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  const title = payload.title || 'Preciso de um';
  const options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    data: payload.data || { url: payload.url || '/' },
    actions: payload.actions || [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Fechar' },
    ],
    tag: payload.tag || 'pwa-notification',
    renotify: payload.renotify || false,
  };
  if (payload.image) options.image = payload.image;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ── Background Sync ──
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-data') {
    event.waitUntil(Promise.resolve());
  }
});

// ── Periodic Background Sync ──
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-content') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.add('/'))
    );
  }
});

// ── Permite ao app forçar atualização imediata ──
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
