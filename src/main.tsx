import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Guard: unregister service workers in preview/iframe contexts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

if (!isPreviewHost && !isInIframe && !isLocalhost && window.location.protocol === "http:") {
  window.location.replace(
    `https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

if (!isPreviewHost && !isInIframe && "serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

if (!isPreviewHost && !isInIframe && "serviceWorker" in navigator) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById("root")!).render(<App />);
