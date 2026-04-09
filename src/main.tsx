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
  // New version detected — purge everything
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
