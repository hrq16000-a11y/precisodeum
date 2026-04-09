import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { cleanupFrequencyData } from "@/lib/sponsorRanking";

// Clean stale frequency-cap data from previous sessions
cleanupFrequencyData();

// ── Auto-clear caches after every new deploy ──
const BUILD_VERSION = __BUILD_TIMESTAMP__;
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

createRoot(document.getElementById("root")!).render(<App />);
