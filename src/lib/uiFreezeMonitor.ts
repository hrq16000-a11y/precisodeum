import { reportError, trackAction } from '@/lib/errorReporter';

let initialized = false;
let reportedKey: string | null = null;

const isDashboardPath = () => window.location.pathname.startsWith('/dashboard');

const isBlockingOverlay = (element: Element | null) => {
  if (!element) return false;
  const blocker = element.closest('[data-radix-dialog-overlay], [role="dialog"], [data-ui-blocker], .fixed, .absolute');
  if (!blocker) return false;
  const main = element.closest('[data-dashboard-main="true"]');
  if (main) return false;

  const style = window.getComputedStyle(blocker);
  const rect = blocker.getBoundingClientRect();
  const coversViewport = rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.8;
  const canBlockClicks = style.pointerEvents !== 'none' && style.visibility !== 'hidden' && style.display !== 'none';
  return coversViewport && canBlockClicks;
};

const inspectForFreeze = async () => {
  if (!isDashboardPath()) return;
  const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  if (!isBlockingOverlay(target)) return;

  const blocker = target?.closest('[data-radix-dialog-overlay], [role="dialog"], [data-ui-blocker], .fixed, .absolute') as HTMLElement | null;
  const component = blocker?.getAttribute('data-component') || blocker?.getAttribute('aria-label') || blocker?.className?.toString().slice(0, 120) || 'unknown-overlay';
  const key = `${window.location.pathname}:${component}`;
  if (reportedKey === key) return;
  reportedKey = key;
  trackAction('ui_freeze_detected', component);
  await reportError({
    errorMessage: `Possível travamento de clique por overlay: ${component}`,
    componentName: 'DashboardUiFreezeMonitor',
    actionContext: 'Monitoramento automático de UI congelada no Dashboard',
    severity: 'critical',
  });
};

/**
 * PR-A5 — Performance: só inspeciona quando a aba está visível e usa
 * requestIdleCallback para evitar contenção com a thread principal. Em
 * background o navegador já throttla setInterval, mas o guard explícito
 * elimina o trabalho de elementFromPoint/getComputedStyle (que força
 * layout) em abas inativas, economizando CPU e bateria.
 */
type IdleCallbackHandle = number;
type IdleRequestCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
interface IdleWindow extends Window {
  requestIdleCallback?: (cb: IdleRequestCallback, opts?: { timeout: number }) => IdleCallbackHandle;
}

const scheduleIdle = (cb: () => void) => {
  const w = window as IdleWindow;
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(() => cb(), { timeout: 1500 });
  } else {
    // Fallback: macro task fora do hot path de input/scroll.
    setTimeout(cb, 0);
  }
};

export const initializeUiFreezeMonitor = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.setInterval(() => {
    // Gate por visibilidade: aba em background não precisa de monitor.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    scheduleIdle(() => { void inspectForFreeze(); });
  }, 5000);
};