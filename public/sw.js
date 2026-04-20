// ─── Preciso de um — Service Worker v6 (KILL SWITCH) ───
// Versão de auto-desregistro: limpa todos os caches e remove o SW antigo
// que estava servindo HTML desatualizado e travando o carregamento.
// Após todos os clientes recarregarem, este arquivo pode ser substituído
// por um novo SW funcional.

self.addEventListener('install', (event) => {
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

// Não interceptar nenhum fetch — deixa o navegador buscar tudo da rede
self.addEventListener('fetch', () => {});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
