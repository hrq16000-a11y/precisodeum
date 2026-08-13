/**
 * Diagnóstico de flicker do header (dev/diagnóstico only).
 *
 * Responde rapidamente "por que piscou?" classificando a causa em:
 *  - `no_intersection_observer` → ambiente sem IntersectionObserver (fallback eager)
 *  - `header_height_change`     → altura do header mudou (compact/expand) → CLS
 *  - `layout_shift`             → shift reportado pelo PerformanceObserver
 *  - `logo_load_delay`          → logo demorou a decodificar (skeleton visível)
 *
 * Não envia nada para o backend e nunca roda em produção sem o flag
 * `?debug_header=1` (ou localStorage `debug_header`).
 */

export type HeaderFlickerReason =
  | 'no_intersection_observer'
  | 'header_height_change'
  | 'layout_shift'
  | 'logo_load_delay';

export interface HeaderFlickerEvent {
  reason: HeaderFlickerReason;
  detail?: Record<string, unknown>;
  at: number;
}

const buffer: HeaderFlickerEvent[] = [];
const MAX_EVENTS = 50;

export const isHeaderDiagnosticsEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (import.meta.env?.DEV) return true;
    if (new URLSearchParams(window.location.search).has('debug_header')) return true;
    return window.localStorage.getItem('debug_header') === '1';
  } catch {
    return false;
  }
};

export const logHeaderFlicker = (
  reason: HeaderFlickerReason,
  detail?: Record<string, unknown>,
): HeaderFlickerEvent => {
  const event: HeaderFlickerEvent = { reason, detail, at: Date.now() };
  buffer.push(event);
  if (buffer.length > MAX_EVENTS) buffer.shift();
  if (isHeaderDiagnosticsEnabled()) {
    // eslint-disable-next-line no-console
    console.info(`[header-flicker] ${reason}`, detail ?? {});
  }
  return event;
};

export const getHeaderFlickerEvents = (): HeaderFlickerEvent[] => [...buffer];
export const clearHeaderFlickerEvents = (): void => {
  buffer.length = 0;
};

/**
 * Observa altura do header e layout shifts. Retorna cleanup.
 * Falha-soft em ambientes sem ResizeObserver/PerformanceObserver.
 */
export const observeHeaderFlicker = (el: HTMLElement | null): (() => void) => {
  if (typeof window === 'undefined' || !el) return () => {};
  const cleanups: Array<() => void> = [];

  if (typeof IntersectionObserver === 'undefined') {
    logHeaderFlicker('no_intersection_observer', { fallback: 'eager' });
  }

  if (typeof ResizeObserver !== 'undefined') {
    let last = el.getBoundingClientRect().height;
    const ro = new ResizeObserver(() => {
      const next = el.getBoundingClientRect().height;
      if (Math.abs(next - last) > 1) {
        logHeaderFlicker('header_height_change', { from: last, to: next });
        last = next;
      }
    });
    ro.observe(el);
    cleanups.push(() => ro.disconnect());
  }

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
          if (entry.hadRecentInput) continue;
          if ((entry.value ?? 0) > 0.01) {
            logHeaderFlicker('layout_shift', { value: entry.value });
          }
        }
      });
      po.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
      cleanups.push(() => po.disconnect());
    } catch {
      /* layout-shift não suportado */
    }
  }

  return () => cleanups.forEach((fn) => fn());
};
