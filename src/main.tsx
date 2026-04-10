import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { cleanupFrequencyData } from "@/lib/sponsorRanking";

// Clean stale frequency-cap data from previous sessions
cleanupFrequencyData();

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
  console.log('[Cache] New build detected, caches cleared.');
}

// ── Daily cache purge (24 h) ──
const PURGE_KEY = 'cache-last-purge';
const PURGE_INTERVAL = 86_400_000; // 24 h in ms
const PRESERVE_KEYS = new Set([
  STORED_VERSION_KEY,
  PURGE_KEY,
  'app-build-version',
  'sb-qaftogrqeyymewoofexc-auth-token',  // keep auth
  'cookie-consent',
  'pwa-dismiss-ts',
  'pwa-visit-count',
  'theme',
]);

const lastPurge = Number(localStorage.getItem(PURGE_KEY) || '0');
const now = Date.now();

if (now - lastPurge > PURGE_INTERVAL) {
  // 1. Purge Cache API
  if ('caches' in window) {
    caches.keys().then(names => names.forEach(n => caches.delete(n)));
  }

  // 2. Clear localStorage except preserved keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && !PRESERVE_KEYS.has(k) && !k.startsWith('sb-')) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // 3. Signal Service Worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'PURGE_CACHES' });
  }

  // 4. Flag for React Query invalidation (picked up by App.tsx)
  (window as any).__DAILY_PURGE_TRIGGERED__ = true;

  localStorage.setItem(PURGE_KEY, String(now));
  console.log('[Cache] Daily purge executed.');
}

// ── Lazy image reveal via IntersectionObserver ──
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

// Observe current and future lazy images
const observeLazyImages = () => {
  document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]:not(.img-revealed)').forEach((img) => {
    imgObserver.observe(img);
  });
};

// Run on mutations
const bodyObs = new MutationObserver(() => observeLazyImages());
bodyObs.observe(document.documentElement, { childList: true, subtree: true });
observeLazyImages();

createRoot(document.getElementById("root")!).render(<App />);
