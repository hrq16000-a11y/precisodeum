/**
 * Global Error Monitor
 *
 * Captura erros não-React (window.onerror + unhandledrejection) e reporta
 * para `error_reports`, complementando o `ErrorGuard` (que só captura erros
 * dentro da árvore React).
 *
 * Integrável a Sentry/LogRocket: detecta `window.Sentry` ou `window.LogRocket`
 * e encaminha automaticamente, mantendo o registro local também.
 *
 * Contexto enriquecido enviado a sinks externos:
 *  - userId, route (pathname+search), referrer, viewport, online status,
 *    last action history (via `errorReporter`).
 */

import { reportError, trackAction } from './errorReporter';
import { supabase } from '@/integrations/supabase/client';
import { APP_VERSION } from './appVersion';

let installed = false;
let cachedUserId: string | null = null;

const NOISE_PATTERNS = [
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
  /Network request failed/i,
  /Load failed/i,
  /chrome-extension:\/\//i,
  /dynamically imported module/i, // tratado pelo bootstrap auto-heal
];

const RATE_LIMIT_WINDOW_MS = 5000;
const RATE_LIMIT_MAX = 5;
const recentErrors = new Map<string, number[]>();

const isNoise = (msg: string) => NOISE_PATTERNS.some((rx) => rx.test(msg));

const isRateLimited = (key: string) => {
  const now = Date.now();
  const arr = recentErrors.get(key) || [];
  const fresh = arr.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  fresh.push(now);
  recentErrors.set(key, fresh);
  return fresh.length > RATE_LIMIT_MAX;
};

interface ExternalSink {
  captureException?: (err: unknown, ctx?: Record<string, unknown>) => void;
  setContext?: (name: string, ctx: Record<string, unknown>) => void;
}

const getExternalSink = (): ExternalSink | null => {
  const w = window as unknown as { Sentry?: ExternalSink; LogRocket?: ExternalSink };
  return w.Sentry || w.LogRocket || null;
};

const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches
    || (navigator as any).standalone === true;
  return {
    isMobile,
    isStandalone,
    platform: (navigator as any).userAgentData?.platform || navigator.platform || 'unknown',
    dpr: window.devicePixelRatio || 1,
  };
};

const buildContext = () => ({
  userId: cachedUserId,
  appVersion: APP_VERSION,
  route: window.location.pathname + window.location.search,
  referrer: document.referrer || null,
  viewport: `${window.innerWidth}x${window.innerHeight}`,
  online: navigator.onLine,
  language: navigator.language,
  userAgent: navigator.userAgent,
  device: getDeviceInfo(),
  timestamp: new Date().toISOString(),
});

/**
 * Instala os listeners globais. Idempotente.
 */
export function installGlobalErrorMonitor() {
  if (installed) return;
  installed = true;

  trackAction('app:boot', `app boot at ${new Date().toISOString()}`);

  // Cacheia userId para incluir no contexto sem chamar getUser() em cada erro
  void supabase.auth.getUser().then(({ data }) => {
    cachedUserId = data?.user?.id ?? null;
    const sink = getExternalSink();
    sink?.setContext?.('user', { id: cachedUserId });
  }).catch(() => { /* noop */ });

  // Define versão do app no sink externo (uma vez)
  const sinkBoot = getExternalSink();
  sinkBoot?.setContext?.('app', { version: APP_VERSION });

  supabase.auth.onAuthStateChange((_event, session) => {
    cachedUserId = session?.user?.id ?? null;
    const sink = getExternalSink();
    sink?.setContext?.('user', { id: cachedUserId });
  });

  // Atualiza contexto de rota a cada navegação SPA (pushState/popstate)
  const onRouteChange = () => {
    const sink = getExternalSink();
    sink?.setContext?.('route', { path: window.location.pathname + window.location.search });
    trackAction('route:change', window.location.pathname);
  };
  window.addEventListener('popstate', onRouteChange);
  // Hook em pushState/replaceState para SPA
  ['pushState', 'replaceState'].forEach((fnName) => {
    const orig = (history as any)[fnName];
    (history as any)[fnName] = function (...args: unknown[]) {
      const result = orig.apply(this, args);
      try { onRouteChange(); } catch { /* noop */ }
      return result;
    };
  });

  window.addEventListener('error', (event) => {
    const message = String(event.message || event.error?.message || '');
    if (!message || isNoise(message)) return;

    const key = `err:${message.slice(0, 80)}`;
    if (isRateLimited(key)) return;

    const ctx = {
      ...buildContext(),
      source: 'window.onerror',
      filename: event.filename,
      line: event.lineno,
      col: event.colno,
    };

    const sink = getExternalSink();
    sink?.captureException?.(event.error || message, ctx);

    void reportError({
      errorMessage: message,
      errorStack: event.error?.stack,
      componentName: 'window',
      actionContext: `window.onerror @ ${event.filename}:${event.lineno}:${event.colno} | route=${ctx.route}`,
      severity: 'error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = event.reason;
    const message = String(reason?.message || reason || '');
    if (!message || isNoise(message)) return;

    const key = `rej:${message.slice(0, 80)}`;
    if (isRateLimited(key)) return;

    const ctx = { ...buildContext(), source: 'unhandledrejection' };

    const sink = getExternalSink();
    sink?.captureException?.(reason, ctx);

    void reportError({
      errorMessage: message,
      errorStack: reason?.stack,
      componentName: 'promise',
      actionContext: `unhandledrejection | route=${ctx.route}`,
      severity: 'error',
    });
  });
}
