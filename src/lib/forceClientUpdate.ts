/**
 * Limpeza forçada de cache + reload (regra padrão a cada correção crítica).
 *
 * Sequência:
 *   1) unregister de todos os Service Workers
 *   2) caches.delete em todas as Cache Storages (PWA / runtime)
 *   3) limpa chaves de cache do app no localStorage (preserva auth do Supabase
 *      e preferências do usuário — apenas remove caches/drafts seguros)
 *   4) location.reload(true)
 *
 * Idempotente. Silencioso em ambientes sem APIs (SSR/test).
 */

// Prefixos do localStorage considerados "cache descartável".
// IMPORTANTE: NÃO inclui chaves do Supabase auth (`sb-*`) nem preferências do
// usuário (cookie consent, prefs de notificação, etc.).
const SAFE_LS_PREFIXES = [
  "providers-cache",
  "leads-cache",
  "lovable-cache",
  "rq-",
  "categories-cache",
  "site_settings_cache",
  "service-wizard-draft-",
  "onboarding_v2_draft",
  "app-runtime-cache",
];

export async function purgeServiceWorkers(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
  } catch {
    /* best-effort */
  }
}

export async function purgeCacheStorage(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
  } catch {
    /* best-effort */
  }
}

export function purgeLocalStorageSafeCaches(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (SAFE_LS_PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
    }
    keys.forEach((k) => {
      try { localStorage.removeItem(k); } catch { /* noop */ }
    });
  } catch {
    /* best-effort */
  }
}

/** Executa as três limpezas em paralelo (fail-safe). */
export async function purgeAllClientCaches(): Promise<void> {
  await Promise.all([
    purgeServiceWorkers(),
    purgeCacheStorage(),
    Promise.resolve(purgeLocalStorageSafeCaches()),
  ]);
}

/** Limpa tudo e recarrega a página. */
export async function forceClientUpdate(): Promise<void> {
  await purgeAllClientCaches();
  if (typeof window !== "undefined") {
    try {
      // Cache-buster duro: query param garantido novo a cada reload.
      const url = new URL(window.location.href);
      url.searchParams.set("_v", Date.now().toString(36));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  }
}

/** Apenas para testes. */
export const __testing__ = { SAFE_LS_PREFIXES };
