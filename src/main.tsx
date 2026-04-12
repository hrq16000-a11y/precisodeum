import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── RENDER FIRST — everything else deferred ──
createRoot(document.getElementById("root")!).render(<App />);

// Remove static shell once React has painted
requestAnimationFrame(() => {
  const shell = document.getElementById('app-shell');
  if (shell) shell.remove();
});

// ── All non-critical work runs AFTER first paint ──
const deferWork = (fn: () => void) => {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(fn);
  } else {
    setTimeout(fn, 300);
  }
};

deferWork(() => {
  // Cleanup sponsor frequency data
  import("@/lib/sponsorRanking").then(m => m.cleanupFrequencyData());

  // ── Auto-clear caches after every new deploy ──
  // @ts-ignore — injected by Vite define config at build time
  const BUILD_VERSION: string = __BUILD_TIMESTAMP__;
  const STORED_VERSION_KEY = 'app-build-version';

  const storedVersion = localStorage.getItem(STORED_VERSION_KEY);
  if (storedVersion !== String(BUILD_VERSION)) {
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(n => caches.delete(n)));
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
    }
    localStorage.setItem(STORED_VERSION_KEY, String(BUILD_VERSION));
  }

  // ── Daily cache purge (24 h) ──
  const PURGE_KEY = 'cache-last-purge';
  const PURGE_INTERVAL = 86_400_000;
  const PRESERVE_KEYS = new Set([
    STORED_VERSION_KEY, PURGE_KEY, 'app-build-version',
    'sb-qaftogrqeyymewoofexc-auth-token', 'cookie-consent',
    'pwa-dismiss-ts', 'pwa-visit-count', 'theme',
  ]);

  const lastPurge = Number(localStorage.getItem(PURGE_KEY) || '0');
  const now = Date.now();

  if (now - lastPurge > PURGE_INTERVAL) {
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(n => caches.delete(n)));
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !PRESERVE_KEYS.has(k) && !k.startsWith('sb-')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'PURGE_CACHES' });
    }
    (window as any).__DAILY_PURGE_TRIGGERED__ = true;
    localStorage.setItem(PURGE_KEY, String(now));
  }
});

// ── Lazy image reveal via IntersectionObserver (deferred) ──
deferWork(() => {
  const revealImage = (img: HTMLImageElement) => {
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('img-revealed');
    } else {
      img.addEventListener('load', () => img.classList.add('img-revealed'), { once: true });
      img.addEventListener('error', () => img.classList.add('img-revealed'), { once: true });
    }
  };

  const imgObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          revealImage(e.target as HTMLImageElement);
          imgObserver.unobserve(e.target);
        }
      });
    },
    { rootMargin: '200px' }
  );

  const observeLazyImages = () => {
    document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]:not(.img-revealed)').forEach((img) => {
      imgObserver.observe(img);
    });
  };

  let debounceId: number | undefined;
  const root = document.getElementById('root');
  if (!root) return;
  const bodyObs = new MutationObserver(() => {
    if (debounceId) return;
    debounceId = requestAnimationFrame(() => {
      observeLazyImages();
      debounceId = undefined;
    });
  });
  bodyObs.observe(root, { childList: true, subtree: true });
  observeLazyImages();
});

// ── Deferred Service Worker registration ──
deferWork(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }
});
