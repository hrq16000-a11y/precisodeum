// Testes de forceClientUpdate: limpa SW + caches + localStorage seletivo
// e nunca quebra quando APIs do navegador estão indisponíveis.
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

describe("forceClientUpdate — limpeza segura", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não lança quando serviceWorker e caches não existem", async () => {
    const { purgeAllClientCaches } = await import("@/lib/forceClientUpdate");
    await expect(purgeAllClientCaches()).resolves.toBeUndefined();
  });

  it("remove apenas chaves de cache do localStorage e preserva auth/preferências", async () => {
    localStorage.setItem("providers-cache:list", "abc");
    localStorage.setItem("rq-leads-1", "xxx");
    localStorage.setItem("service-wizard-draft-user1", "{}");
    localStorage.setItem("sb-precisodeum-auth-token", "should-stay");
    localStorage.setItem("cookie_consent_v2", "should-stay");
    localStorage.setItem("user_pref_theme", "dark");

    const { purgeLocalStorageSafeCaches } = await import("@/lib/forceClientUpdate");
    purgeLocalStorageSafeCaches();

    expect(localStorage.getItem("providers-cache:list")).toBeNull();
    expect(localStorage.getItem("rq-leads-1")).toBeNull();
    expect(localStorage.getItem("service-wizard-draft-user1")).toBeNull();
    // preservados
    expect(localStorage.getItem("sb-precisodeum-auth-token")).toBe("should-stay");
    expect(localStorage.getItem("cookie_consent_v2")).toBe("should-stay");
    expect(localStorage.getItem("user_pref_theme")).toBe("dark");
  });

  it("purgeServiceWorkers chama unregister em todos os registros", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    (navigator as any).serviceWorker = {
      getRegistrations: vi.fn().mockResolvedValue([{ unregister }, { unregister }]),
    };
    const { purgeServiceWorkers } = await import("@/lib/forceClientUpdate");
    await purgeServiceWorkers();
    expect(unregister).toHaveBeenCalledTimes(2);
    delete (navigator as any).serviceWorker;
  });

  it("purgeCacheStorage tolera erro em caches.delete", async () => {
    (window as any).caches = {
      keys: vi.fn().mockResolvedValue(["c1", "c2"]),
      delete: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const { purgeCacheStorage } = await import("@/lib/forceClientUpdate");
    await expect(purgeCacheStorage()).resolves.toBeUndefined();
    delete (window as any).caches;
  });
});
