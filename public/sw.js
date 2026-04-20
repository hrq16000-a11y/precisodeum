// ─── Preciso de um — Service Worker KILL SWITCH (permanente) ───
// Este SW existe APENAS para se auto-desregistrar e limpar caches antigos.
// Política definitiva: o app NÃO usa Service Worker. Sempre busca a versão
// mais recente da rede para evitar telas brancas / versões desatualizadas.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}
    try {
      await self.registration.unregister();
    } catch (_) {}
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      try { client.navigate(client.url); } catch (_) {}
    }
  })());
});

// Nunca interceptar requests — sempre rede direta
self.addEventListener('fetch', () => {});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
