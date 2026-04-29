/**
 * Global Error Monitor
 *
 * Captura erros não-React (window.onerror + unhandledrejection) e reporta
 * para `error_reports`, complementando o `ErrorGuard` (que só captura erros
 * dentro da árvore React).
 *
 * Integrável a Sentry/LogRocket: basta configurar VITE_SENTRY_DSN e o hook
 * já encaminha ao external sink, mantendo o registro local também.
 */

import { reportError, trackAction } from './errorReporter';

let installed = false;

const NOISE_PATTERNS = [
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
  /Network request failed/i,
  /Load failed/i,
  /chrome-extension:\/\//i,
  /dynamically imported module/i, // tratado pelo bootstrap auto-heal
];

const isNoise = (msg: string) => NOISE_PATTERNS.some((rx) => rx.test(msg));

interface ExternalSink {
  captureException?: (err: unknown, ctx?: Record<string, unknown>) => void;
}

const getExternalSink = (): ExternalSink | null => {
  // Sentry e LogRocket expõem objetos globais quando seus SDKs estão instalados
  const w = window as unknown as { Sentry?: ExternalSink; LogRocket?: ExternalSink };
  return w.Sentry || w.LogRocket || null;
};

/**
 * Instala os listeners globais. Idempotente.
 */
export function installGlobalErrorMonitor() {
  if (installed) return;
  installed = true;

  trackAction('app:boot', `app boot at ${new Date().toISOString()}`);

  window.addEventListener('error', (event) => {
    const message = String(event.message || event.error?.message || '');
    if (!message || isNoise(message)) return;

    const sink = getExternalSink();
    sink?.captureException?.(event.error || message, {
      source: 'window.onerror',
      filename: event.filename,
      line: event.lineno,
      col: event.colno,
    });

    void reportError({
      errorMessage: message,
      errorStack: event.error?.stack,
      componentName: 'window',
      actionContext: `window.onerror @ ${event.filename}:${event.lineno}:${event.colno}`,
      severity: 'error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = event.reason;
    const message = String(reason?.message || reason || '');
    if (!message || isNoise(message)) return;

    const sink = getExternalSink();
    sink?.captureException?.(reason, { source: 'unhandledrejection' });

    void reportError({
      errorMessage: message,
      errorStack: reason?.stack,
      componentName: 'promise',
      actionContext: 'unhandledrejection',
      severity: 'error',
    });
  });
}
