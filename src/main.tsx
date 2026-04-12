import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root")!;
const shellElement = document.getElementById("app-shell");

const host = window.location.hostname;
const isPreviewHost = host.endsWith(".lovableproject.com") || host.startsWith("id-preview--");
const shouldUseServiceWorker = import.meta.env.PROD && !isPreviewHost;
const PREVIEW_CACHE_RESET_KEY = "preview-cache-reset-v1";

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

const resetPreviewCachesIfNeeded = async () => {
  if (shouldUseServiceWorker) return false;

  try {
    const registrations = "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistrations()
      : [];
    const cacheNames = "caches" in window ? await caches.keys() : [];

    await Promise.all(registrations.map((registration) => registration.unregister()));
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));

    const alreadyReset = sessionStorage.getItem(PREVIEW_CACHE_RESET_KEY) === "1";
    if (!alreadyReset && (registrations.length > 0 || cacheNames.length > 0)) {
      sessionStorage.setItem(PREVIEW_CACHE_RESET_KEY, "1");
      window.location.reload();
      return true;
    }
  } catch {
    // silent: preview cleanup is best-effort
  }

  return false;
};

const bootstrap = async () => {
  const reloadingForFreshPreview = await resetPreviewCachesIfNeeded();
  if (reloadingForFreshPreview) return;

  createRoot(rootElement).render(<App />);
  removeShell();

  deferWork(() => {
    import("@/lib/sponsorRanking").then((m) => m.cleanupFrequencyData());

    if (!shouldUseServiceWorker) return;

    // @ts-ignore — injected by Vite define config at build time
    const BUILD_VERSION: string = __BUILD_TIMESTAMP__;
    const STORED_VERSION_KEY = "app-build-version";

    const storedVersion = localStorage.getItem(STORED_VERSION_KEY);
    if (storedVersion !== String(BUILD_VERSION)) {
      if ("caches" in window) {
        caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
      }
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
          });
        });
      }
      localStorage.setItem(STORED_VERSION_KEY, String(BUILD_VERSION));
    }

    const PURGE_KEY = "cache-last-purge";
    const PURGE_INTERVAL = 86_400_000;
    const PRESERVE_KEYS = new Set([
      STORED_VERSION_KEY, PURGE_KEY, "app-build-version",
      "sb-qaftogrqeyymewoofexc-auth-token", "cookie-consent",
      "pwa-dismiss-ts", "pwa-visit-count", "theme",
    ]);

    const lastPurge = Number(localStorage.getItem(PURGE_KEY) || "0");
    const now = Date.now();

    if (now - lastPurge > PURGE_INTERVAL) {
      if ("caches" in window) {
        caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
      }
      const keysToRemove: string[] = [];
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key && !PRESERVE_KEYS.has(key) && !key.startsWith("sb-")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "PURGE_CACHES" });
      }
      (window as Window & { __DAILY_PURGE_TRIGGERED__?: boolean }).__DAILY_PURGE_TRIGGERED__ = true;
      localStorage.setItem(PURGE_KEY, String(now));
    }
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

  deferWork(() => {
    if (shouldUseServiceWorker && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  });
};

void bootstrap();
