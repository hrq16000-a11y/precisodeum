import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { cleanupFrequencyData } from "@/lib/sponsorRanking";

// Clean stale frequency-cap data from previous sessions
cleanupFrequencyData();

// Force-clear all caches on startup to ensure fresh content
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => caches.delete(name));
  });
}

// Unregister all service workers to force re-fetch
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => r.unregister());
  });
}

createRoot(document.getElementById("root")!).render(<App />);
