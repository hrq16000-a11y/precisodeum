import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");
const shellElement = document.getElementById("app-shell");

(window as Window & { __appMainLoaded?: boolean }).__appMainLoaded = true;

const AUTO_HEAL_KEY = "__bootstrap_autoheal_attempt_v2";
const MAX_AUTO_HEAL_ATTEMPTS = 1;
const DAILY_RESET_KEY = "sw-killswitch-reset-day-v1";
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CURRENT_BUILD_ID = (import.meta as any).env?.VITE_BUILD_ID
  || document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.src
  || '';
const CURRENT_DAY_KEY = new Date().toISOString().slice(0, 10);

const preloadCriticalAssets = () => {
  const head = document.head;
  if (!head) return;
  for (const href of ['/hero-cat-instalacoes.webp', '/lovable-uploads/logo-brand-380.webp']) {
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    if (href.endsWith('.webp')) link.type = 'image/webp';
    head.appendChild(link);
  }
};

const getAutoHealAttempts = () => {
  try {
    return Number(sessionStorage.getItem(AUTO_HEAL_KEY) || "0") || 0;
  } catch {
    return 0;
  }
};

const setAutoHealAttempts = (value: number) => {
  try {
    if (value <= 0) sessionStorage.removeItem(AUTO_HEAL_KEY);
    else sessionStorage.setItem(AUTO_HEAL_KEY, String(value));
  } catch {
    // best-effort
  }
};

const clearAutoHealAttempts = () => setAutoHealAttempts(0);
const markAutoHealAttempt = () => setAutoHealAttempts(getAutoHealAttempts() + 1);

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

const setShellSupportState = (message: string, showSupport = false) => {
  const recovery = document.getElementById("app-shell-recovery");
  const title = document.getElementById("app-shell-recovery-title");
  const msg = document.getElementById("app-shell-recovery-msg");
  const actions = document.getElementById("app-shell-actions");

  if (recovery) (recovery as HTMLElement).style.display = "block";
  if (title) title.textContent = showSupport
    ? "Precisamos de ajuda para concluir a restauração"
    : "Estamos restaurando o aplicativo";
  if (msg) msg.textContent = message;
  if (actions) (actions as HTMLElement).style.display = showSupport ? "flex" : "none";
};

const purgeAllCachesAndSWs = async (): Promise<{ hadAny: boolean }> => {
  let hadAny = false;
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) hadAny = true;
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
    }
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      if (cacheNames.length > 0) hadAny = true;
      await Promise.all(cacheNames.map((name) => caches.delete(name).catch(() => false)));
    }
  } catch {
    // best-effort
  }
  return { hadAny };
};

const tryAutomatedRecovery = async (reason: string, err?: unknown) => {
  console.error(`[bootstrap] auto-heal triggered: ${reason}`, err);

  const attempts = getAutoHealAttempts();
  if (attempts < MAX_AUTO_HEAL_ATTEMPTS) {
    markAutoHealAttempt();
    await purgeAllCachesAndSWs();
    forceFreshReload();
    return;
  }

  setShellSupportState(
    "Estamos finalizando a restauração automática em segundo plano.",
    false,
  );
};

const resetCachesIfNeeded = async () => {
  const alreadyResetToday = (() => {
    try {
      return localStorage.getItem(DAILY_RESET_KEY) === CURRENT_DAY_KEY;
    } catch {
      return false;
    }
  })();

  if (alreadyResetToday) return false;

  const { hadAny } = await purgeAllCachesAndSWs();

  try {
    localStorage.setItem(DAILY_RESET_KEY, CURRENT_DAY_KEY);
  } catch {
    // best-effort
  }

  if (hadAny) {
    forceFreshReload();
    return true;
  }

  return false;
};

const showVersionUpdateToast = () => {
  // Toast persistente — usa o sonner já carregado pelo App via DeferredShell.
  // Se o sonner ainda não montou, faz fallback para um banner DOM puro.
  const triggerReload = () => {
    try {
      // Limpa caches de SW antes de recarregar para garantir bundle novo
      void purgeAllCachesAndSWs().finally(() => {
        window.location.reload();
      });
    } catch {
      window.location.reload();
    }
  };

  // Tenta sonner primeiro
  import('sonner').then(({ toast }) => {
    toast('Uma nova versão está disponível', {
      description: 'Atualize para receber as últimas melhorias do Preciso de Um.',
      duration: Infinity,
      id: 'app-version-update',
      action: { label: 'Atualizar agora', onClick: triggerReload },
    });
  }).catch(() => {
    // Fallback: banner DOM persistente no topo
    if (document.getElementById('app-version-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'app-version-banner';
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483646;background:hsl(var(--accent,210 90% 55%));color:#fff;padding:10px 16px;display:flex;align-items:center;justify-content:center;gap:12px;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.15);';
    banner.innerHTML = '<span>Uma nova versão do Preciso de Um está disponível.</span>';
    const btn = document.createElement('button');
    btn.textContent = 'Atualizar agora';
    btn.style.cssText = 'background:#fff;color:#111;border:0;padding:6px 14px;border-radius:6px;font-weight:600;cursor:pointer;';
    btn.addEventListener('click', triggerReload);
    banner.appendChild(btn);
    document.body.appendChild(banner);
  });
};

const startVersionWatcher = () => {
  if (!CURRENT_BUILD_ID) return;

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
      if (remoteBuild && !CURRENT_BUILD_ID.includes(remoteBuild) && promptedForBuild !== remoteBuild) {
        promptedForBuild = remoteBuild;
        // Mudança crítica: NÃO recarrega automaticamente para preservar
        // progresso do usuário (ex: Wizard, formulários). Mostra toast/banner
        // persistente com botão explícito de "Atualizar agora".
        showVersionUpdateToast();
      }
    } catch {
      // offline / falha de rede — ignora
    }
  };

  setInterval(check, VERSION_CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
};

const installBootstrapGuards = () => {
  window.addEventListener("error", (event) => {
    if (!event.error && !event.message) return;

    const message = String(event.message || "").toLowerCase();

    if (
      message.includes("dynamically imported module")
      || message.includes("module script")
    ) {
      void tryAutomatedRecovery("window-error", event.error || event.message);
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = String(reason instanceof Error ? reason.message : reason || "").toLowerCase();

    if (
      message.includes("dynamically imported module")
      || message.includes("module script")
    ) {
      event.preventDefault?.();
      void tryAutomatedRecovery("unhandledrejection", reason);
    }
  });
};

const bootstrap = () => {
  try {
    if (!rootElement) throw new Error("Elemento root ausente.");
    preloadCriticalAssets();

    if ((window as any).__appShellTimer) {
      clearTimeout((window as any).__appShellTimer);
      delete (window as any).__appShellTimer;
    }

    const env = (import.meta as any).env || {};
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Configuração do backend ausente.");
    }

    createRoot(rootElement).render(<App />);

    clearAutoHealAttempts();
    removeShell();

    deferWork(() => {
      void resetCachesIfNeeded().catch((err) => {
        console.error("[bootstrap] background cache reset failed", err);
      });
    });

    deferWork(() => {
      import("./lib/performanceTelemetry").then((module) => module.installPerformanceTelemetry());
      import("@/styles/deferred-animations.css");
      import("@/lib/sponsorRanking").then((module) => module.cleanupFrequencyData());
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
        { rootMargin: "200px" },
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
  } catch (err) {
    void tryAutomatedRecovery("bootstrap-sync-error", err);
  }
};

installBootstrapGuards();
void bootstrap();
