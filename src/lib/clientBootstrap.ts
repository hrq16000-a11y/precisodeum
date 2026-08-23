// ported from main.tsx — client-only bootstrap side-effects for the TanStack
// Start migration. Chamado uma única vez em useEffect no RootComponent.
// NOTA: registro de Service Worker foi intencionalmente removido — o kill-switch
// em public/sw.js é entregue pelo polling automático do browser (design Step 4.5).
import { installConsentBridge } from "@/lib/consentBridge";
import { installWebVitalsPerRoute } from "@/lib/webVitalsPerRoute";
import { APP_VERSION, APP_BUILD_ID } from "@/lib/appVersion";

let installed = false;

const AUTO_HEAL_KEY = "__bootstrap_autoheal_attempt_v2";
const MAX_AUTO_HEAL_ATTEMPTS = 1;
const DAILY_RESET_KEY = "sw-killswitch-reset-day-v1";
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

const getAutoHealAttempts = () => {
  try { return Number(sessionStorage.getItem(AUTO_HEAL_KEY) || "0") || 0; } catch { return 0; }
};
const setAutoHealAttempts = (value: number) => {
  try {
    if (value <= 0) sessionStorage.removeItem(AUTO_HEAL_KEY);
    else sessionStorage.setItem(AUTO_HEAL_KEY, String(value));
  } catch { /* best-effort */ }
};

const forceFreshReload = () => {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("__fresh", String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
};

const purgeAllCachesAndSWs = async (): Promise<void> => {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister().catch(() => false)));
    }
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name).catch(() => false)));
    }
  } catch { /* best-effort */ }
};

const tryAutomatedRecovery = async (reason: string, err?: unknown) => {
  console.error(`[bootstrap] auto-heal triggered: ${reason}`, err);
  const attempts = getAutoHealAttempts();
  if (attempts < MAX_AUTO_HEAL_ATTEMPTS) {
    setAutoHealAttempts(attempts + 1);
    await purgeAllCachesAndSWs();
    forceFreshReload();
  }
};

const installBootstrapGuards = () => {
  window.addEventListener("error", (event) => {
    if (!event.error && !event.message) return;
    const message = String(event.message || "").toLowerCase();
    if (message.includes("dynamically imported module") || message.includes("module script")) {
      void tryAutomatedRecovery("window-error", event.error || event.message);
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = String(reason instanceof Error ? reason.message : reason || "").toLowerCase();
    const isNonCritical =
      message.includes("performancetelemetry")
      || message.includes("deferred-animations")
      || message.includes("sponsorranking");
    if (!isNonCritical && (message.includes("dynamically imported module") || message.includes("module script"))) {
      event.preventDefault?.();
      void tryAutomatedRecovery("unhandledrejection", reason);
    }
  });
};

const showVersionUpdateToast = () => {
  const triggerReload = () => {
    try {
      void purgeAllCachesAndSWs().finally(() => window.location.reload());
    } catch {
      window.location.reload();
    }
  };
  import("sonner").then(({ toast }) => {
    toast("Uma nova versão está disponível", {
      description: "Atualize para receber as últimas melhorias do Preciso de Um.",
      duration: Infinity,
      id: "app-version-update",
      action: { label: "Atualizar agora", onClick: triggerReload },
    });
  }).catch(() => { /* silencioso — banner DOM legado removido */ });
};

const startVersionWatcher = () => {
  const currentBuildId = (import.meta as any).env?.VITE_BUILD_ID
    || document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.src
    || "";
  if (!currentBuildId) return;
  let promptedForBuild: string | null = null;
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
      if (remoteBuild && !currentBuildId.includes(remoteBuild) && promptedForBuild !== remoteBuild) {
        promptedForBuild = remoteBuild;
        showVersionUpdateToast();
      }
    } catch { /* offline — ignora */ }
  };
  setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    void check();
  }, VERSION_CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
};

const resetLegacyCachesIfNeeded = async () => {
  const currentDay = new Date().toISOString().slice(0, 10);
  const alreadyResetToday = (() => {
    try { return localStorage.getItem(DAILY_RESET_KEY) === currentDay; } catch { return false; }
  })();
  if (alreadyResetToday) return;
  let hadAny = false;
  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      const legacyNames = cacheNames.filter((name) => !name.startsWith("pdu-"));
      if (legacyNames.length > 0) hadAny = true;
      await Promise.all(legacyNames.map((name) => caches.delete(name).catch(() => false)));
    }
  } catch { /* best-effort */ }
  try { localStorage.setItem(DAILY_RESET_KEY, currentDay); } catch { /* best-effort */ }
  if (hadAny) forceFreshReload();
};

const deferWork = (fn: () => void) => {
  if ("requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(fn);
  } else {
    globalThis.setTimeout(fn, 300);
  }
};

const installLazyImageReveal = () => {
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
    { rootMargin: "200px" },
  );
  const observeLazyImages = () => {
    document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]:not(.img-revealed)').forEach((img) => {
      imgObserver.observe(img);
    });
  };
  let debounceId: number | undefined;
  const root = document.body;
  const bodyObserver = new MutationObserver(() => {
    if (debounceId) return;
    debounceId = requestAnimationFrame(() => {
      observeLazyImages();
      debounceId = undefined;
    });
  });
  bodyObserver.observe(root, { childList: true, subtree: true });
  observeLazyImages();
};

/** Instala todos os side-effects de bootstrap do cliente (idempotente). */
export function installClientBootstrap() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Versão/build ativos no DOM — smoke test pós-deploy confirma a release.
  try {
    const meta = document.querySelector('meta[name="app-version"]') ?? document.createElement("meta");
    meta.setAttribute("name", "app-version");
    meta.setAttribute("content", APP_VERSION);
    document.head.appendChild(meta);
    const buildMeta = document.createElement("meta");
    buildMeta.setAttribute("name", "app-build");
    buildMeta.setAttribute("content", APP_BUILD_ID);
    document.head.appendChild(buildMeta);
  } catch { /* best-effort */ }

  (window as Window & { __appMainLoaded?: boolean }).__appMainLoaded = true;

  // Gates de consentimento (gtag/fbq) precisam estar prontos cedo.
  installConsentBridge();

  // Vitals por rota — adiado para depois do first paint.
  const scheduleVitals = () => {
    try { installWebVitalsPerRoute(); } catch { /* best-effort */ }
  };
  if (typeof (window as any).requestIdleCallback === "function") {
    (window as any).requestIdleCallback(scheduleVitals, { timeout: 2500 });
  } else {
    setTimeout(scheduleVitals, 1200);
  }

  installBootstrapGuards();

  import("@/lib/globalErrorMonitor")
    .then((m) => m.installGlobalErrorMonitor())
    .catch((err) => console.warn("[bootstrap] globalErrorMonitor skip", err));

  setAutoHealAttempts(0);

  deferWork(() => {
    void resetLegacyCachesIfNeeded().catch((err) => {
      console.error("[bootstrap] background cache reset failed", err);
    });
  });

  deferWork(() => {
    import("@/lib/performanceTelemetry")
      .then((module) => module.installPerformanceTelemetry())
      .catch((err) => console.warn("[bootstrap] performanceTelemetry skip", err));
    import("@/styles/deferred-animations.css")
      .catch((err) => console.warn("[bootstrap] deferred-animations skip", err));
    import("@/lib/sponsorRanking")
      .then((module) => module.cleanupFrequencyData())
      .catch((err) => console.warn("[bootstrap] sponsorRanking skip", err));
    startVersionWatcher();
  });

  deferWork(installLazyImageReveal);
}
