import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root")!;
const shellElement = document.getElementById("app-shell");

// POLÍTICA DEFINITIVA: nunca usar Service Worker.
// Sempre limpar caches/SWs antigos a cada visita para garantir versão fresca.
const SESSION_RESET_KEY = "sw-killswitch-reset-v2";
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000; // verifica nova versão a cada 5min
const CURRENT_BUILD_ID = (import.meta as any).env?.VITE_BUILD_ID
  || document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.src
  || '';

const forceFreshReload = () => {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("__fresh", String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
};

const removeShell = () => {
  requestAnimationFrame(() => {
    shellElement?.remove();
  });
};

const deferWork = (fn: () => void) => {
  if ("requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback: (callback: () => void) => number }).requestIdleCallback(fn);
  } else {
    globalThis.setTimeout(fn, 300);
  }
};

// Limpa qualquer SW/cache antigo. Roda em TODA visita (preview + produção).
const purgeAllCachesAndSWs = async (): Promise<{ hadAny: boolean }> => {
  let hadAny = false;
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) hadAny = true;
      await Promise.all(registrations.map((r) => r.unregister().catch(() => false)));
    }
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      if (cacheNames.length > 0) hadAny = true;
      await Promise.all(cacheNames.map((n) => caches.delete(n).catch(() => false)));
    }
  } catch {
    // best-effort
  }
  return { hadAny };
};

const resetCachesIfNeeded = async () => {
  const { hadAny } = await purgeAllCachesAndSWs();
  const alreadyReset = sessionStorage.getItem(SESSION_RESET_KEY) === "1";
  if (hadAny && !alreadyReset) {
    sessionStorage.setItem(SESSION_RESET_KEY, "1");
    // Força reload sem cache para garantir bundle atual
    forceFreshReload();
    return true;
  }
  return false;
};

// Verifica periodicamente se o index.html mudou (novo deploy) e recarrega.
const startVersionWatcher = () => {
  if (!CURRENT_BUILD_ID) return;
  const check = async () => {
    try {
      const res = await fetch(window.location.origin + "/?v=" + Date.now(), {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
      });
      if (!res.ok) return;
      const html = await res.text();
      const match = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
      const remoteBuild = match?.[0];
      if (remoteBuild && !CURRENT_BUILD_ID.includes(remoteBuild)) {
        // Nova versão publicada → recarrega já
        forceFreshReload();
      }
    } catch {
      // offline / falha de rede — ignora
    }
  };
  setInterval(check, VERSION_CHECK_INTERVAL_MS);
  // Verifica também ao voltar para a aba
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
};

const bootstrap = async () => {
  const reloading = await resetCachesIfNeeded();
  if (reloading) return;

  createRoot(rootElement).render(<App />);
  removeShell();

  deferWork(() => {
    import("@/styles/deferred-animations.css");
    import("@/lib/sponsorRanking").then((m) => m.cleanupFrequencyData());
    startVersionWatcher();
  });

  deferWork(() => {
    const revealImage = (img: HTMLImageElement) => {
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add("img-revealed");
      } else {
        img.addEventListener("load", () => img.classList.add("img-revealed"), { once: true });
        img.addEventListener("error", () => img.classList.add("img-revealed"), { once: true });
      }
    };

    const imgObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            revealImage(entry.target as HTMLImageElement);
            imgObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "200px" }
    );

    const observeLazyImages = () => {
      document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]:not(.img-revealed)').forEach((img) => {
        imgObserver.observe(img);
      });
    };

    let debounceId: number | undefined;
    const root = document.getElementById("root");
    if (!root) return;

    const bodyObserver = new MutationObserver(() => {
      if (debounceId) return;
      debounceId = requestAnimationFrame(() => {
        observeLazyImages();
        debounceId = undefined;
      });
    });

    bodyObserver.observe(root, { childList: true, subtree: true });
    observeLazyImages();
  });
};

void bootstrap();
