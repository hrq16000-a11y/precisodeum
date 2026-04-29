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

const FORCE_UPDATE_ATTEMPTS_KEY = "app_force_update_attempts_v1";
const FORCE_UPDATE_LAST_ATTEMPT_KEY = "app_force_update_last_attempt_v1";
const FORCE_UPDATE_LAST_SUCCESS_KEY = "app_force_update_last_success_v1";
const FORCE_UPDATE_WINDOW_MS = 60 * 1000;
const FORCE_UPDATE_MAX_ATTEMPTS = 3;

function readNumber(key: string): number {
  if (typeof localStorage === "undefined") return 0;
  try {
    return Number(localStorage.getItem(key) || "0") || 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* best-effort */
  }
}

export function getForceUpdateStats() {
  return {
    attempts: readNumber(FORCE_UPDATE_ATTEMPTS_KEY),
    lastAttemptAt: readNumber(FORCE_UPDATE_LAST_ATTEMPT_KEY),
    lastSuccessAt: readNumber(FORCE_UPDATE_LAST_SUCCESS_KEY),
  };
}

export function markForceUpdateAttempt(now = Date.now()): void {
  const stats = getForceUpdateStats();
  const withinWindow = now - stats.lastAttemptAt <= FORCE_UPDATE_WINDOW_MS;
  const attempts = withinWindow ? stats.attempts + 1 : 1;
  writeNumber(FORCE_UPDATE_ATTEMPTS_KEY, attempts);
  writeNumber(FORCE_UPDATE_LAST_ATTEMPT_KEY, now);
}

export function markForceUpdateSuccess(now = Date.now()): void {
  writeNumber(FORCE_UPDATE_LAST_SUCCESS_KEY, now);
  writeNumber(FORCE_UPDATE_ATTEMPTS_KEY, 0);
}

export function hasExceededForceUpdateAttempts(now = Date.now()): boolean {
  const stats = getForceUpdateStats();
  if (!stats.lastAttemptAt) return false;
  if (now - stats.lastAttemptAt > FORCE_UPDATE_WINDOW_MS) return false;
  return stats.attempts >= FORCE_UPDATE_MAX_ATTEMPTS;
}

export function resetForceUpdateAttempts(): void {
  writeNumber(FORCE_UPDATE_ATTEMPTS_KEY, 0);
}

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
  markForceUpdateAttempt();
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
export const __testing__ = {
  SAFE_LS_PREFIXES,
  FORCE_UPDATE_WINDOW_MS,
  FORCE_UPDATE_MAX_ATTEMPTS,
};
