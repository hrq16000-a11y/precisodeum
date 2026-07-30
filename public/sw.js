// ─── Preciso de um — Service Worker (installable PWA) ───
// Estratégias:
//  • navigate  → network-first com fallback para '/' em cache; offline.html como último recurso.
//  • /assets/, .js, .css, .woff2, imagens estáticas → cache-first (Vite já gera hashes imutáveis).
//  • *.supabase.co (Data API/Auth/Storage/Realtime) → network-only (NUNCA cachear dados de API).
//  • fonts.googleapis.com / fonts.gstatic.com → stale-while-revalidate (30 dias).
//
// IMPORTANTE: ao subir uma release que mexe em assets, incremente CACHE_VERSION.
// O bootstrap em src/main.tsx pode disparar `resetCachesIfNeeded` (1x/dia) que
// desregistra o SW — comportamento herdado da blindagem anterior; o registro
// volta no próximo load.

const CACHE_VERSION = 'v1.2.1';
const STATIC_CACHE = `pdu-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `pdu-runtime-${CACHE_VERSION}`;
const FONTS_CACHE = `pdu-fonts-${CACHE_VERSION}`;
const FONTS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

const PRECACHE_URLS = ['/', '/offline.html', '/manifest.json', '/favicon.ico'];

// ─── INSTALL ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // addAll é tudo-ou-nada — usamos add() individual para tolerar 404 em algum item.
    await Promise.all(
      PRECACHE_URLS.map((url) =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => null),
      ),
    );
    await self.skipWaiting();
  })());
});

// ─── ACTIVATE ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const valid = new Set([STATIC_CACHE, RUNTIME_CACHE, FONTS_CACHE]);
    await Promise.all(keys.filter((k) => !valid.has(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ─── Helpers ───────────────────────────────────────────────────────────────
const isSupabaseHost = (url) =>
  url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in');

const isGoogleFontsHost = (url) =>
  url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

const STATIC_ASSET_EXT = /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|webp|gif|svg|ico|map)$/i;

const isStaticAsset = (url) =>
  url.pathname.startsWith('/assets/') || STATIC_ASSET_EXT.test(url.pathname);

// Stale-while-revalidate com TTL em header sintético (Date) para fontes.
async function staleWhileRevalidateFonts(request) {
  const cache = await caches.open(FONTS_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }).catch(() => cached);

  if (cached) {
    const dateHeader = cached.headers.get('date');
    const cachedAt = dateHeader ? Date.parse(dateHeader) : 0;
    if (cachedAt && Date.now() - cachedAt > FONTS_MAX_AGE_MS) {
      return fetchPromise || cached;
    }
    // Revalida em background, devolve cache imediatamente.
    fetchPromise.catch(() => {});
    return cached;
  }
  return fetchPromise;
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    // Sem rede e sem cache — devolve fallback básico.
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    // Cacheia raiz para fallback offline.
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put('/', response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cache = await caches.open(STATIC_CACHE);
    const rootCached = await cache.match('/');
    if (rootCached) return rootCached;
    const offline = await cache.match('/offline.html');
    if (offline) return offline;
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ─── FETCH ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Só interceptamos GET — métodos mutáveis sempre vão direto pra rede.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Esquemas não-HTTP (chrome-extension://, blob:, data:) são ignorados.
  if (!url.protocol.startsWith('http')) return;

  // ── Supabase: network-only, nunca cachear dados de API ──────────────────
  if (isSupabaseHost(url)) {
    // Não chamamos respondWith — deixa a rede tratar nativamente.
    return;
  }

  // ── Google Fonts: stale-while-revalidate (30 dias) ──────────────────────
  if (isGoogleFontsHost(url)) {
    event.respondWith(staleWhileRevalidateFonts(request));
    return;
  }

  // ── Navegação HTML: network-first com fallback offline ──────────────────
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // ── Assets estáticos (mesma origem ou cross-origin com hash imutável) ───
  if (isStaticAsset(url) && url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Outros requests cross-origin: não interceptamos.
});

// ─── Mensagens (skip waiting manual a partir do client) ────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
