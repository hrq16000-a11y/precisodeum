/**
 * popupGuards — Regras universais para gating de popups/banners marketing.
 *
 * Objetivo: nunca disparar popup automático antes do usuário demonstrar
 * engajamento mínimo (scroll, click, keypress, search). Thresholds conservadores
 * diferentes para mobile vs desktop conforme decisão do produto.
 *
 * Aplicação: PwaInstallBanner, GlobalExitIntentDialog, UrgencyBanner e qualquer
 * novo popup automático. Banners legais (LGPD/cookies) NÃO usam isto — devem
 * aparecer imediatamente por compliance.
 */

const FIRST_VISIT_KEY = 'pd:first-visit-marker-v1';
const INTERACTED_KEY = 'pd:interacted-session-v1';

export interface PopupThresholds {
  /** % de scroll mínimo (0-1) */
  scrollPct: number;
  /** Tempo mínimo de página em ms */
  minTimeMs: number;
  /** Exige interação (scroll/click/keypress) além do tempo? */
  requireInteraction: boolean;
}

/** Thresholds conservadores — decididos com produto. */
export const CONSERVATIVE_MOBILE: PopupThresholds = {
  scrollPct: 0.4,
  minTimeMs: 15_000,
  requireInteraction: true,
};

export const CONSERVATIVE_DESKTOP: PopupThresholds = {
  scrollPct: 0.25,
  minTimeMs: 10_000,
  requireInteraction: false,
};

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

export function getConservativeThresholds(): PopupThresholds {
  return isMobileViewport() ? CONSERVATIVE_MOBILE : CONSERVATIVE_DESKTOP;
}

export function getScrollPct(): number {
  if (typeof window === 'undefined') return 0;
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  return docHeight > 0 ? scrollTop / docHeight : 0;
}

export function hasReachedScrollThreshold(pct: number): boolean {
  return getScrollPct() >= pct;
}

/**
 * M8 · Cache em memória + flush deferido.
 *
 * Os listeners globais disparam em CADA scroll/click/touch. Gravar
 * síncrono em sessionStorage/localStorage no callback do evento bloqueia
 * a main thread (alto INP, scroll jank). Mantemos um espelho em memória
 * e adiamos a escrita real para `requestIdleCallback` / `setTimeout`.
 */
let interactedMem: boolean | null = null;
let firstVisitMem: string | null | undefined;
let pendingFlush = false;

const scheduleIdle: (cb: () => void) => void =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 500 })
    : (cb) => setTimeout(cb, 0);

function flushDeferred() {
  pendingFlush = false;
  try {
    if (interactedMem === true && sessionStorage.getItem(INTERACTED_KEY) !== '1') {
      sessionStorage.setItem(INTERACTED_KEY, '1');
    }
    if (firstVisitMem && !localStorage.getItem(FIRST_VISIT_KEY)) {
      localStorage.setItem(FIRST_VISIT_KEY, firstVisitMem);
    }
  } catch { /* noop */ }
}

function requestFlush() {
  if (pendingFlush) return;
  pendingFlush = true;
  scheduleIdle(flushDeferred);
}

/** Marca interação atual da sessão (chamado pelo listener global). */
export function markInteracted(): void {
  if (interactedMem) return; // já marcado nesta sessão → noop, zero custo no hot path
  interactedMem = true;
  requestFlush();
}

export function hasInteracted(): boolean {
  if (interactedMem !== null) return interactedMem;
  try {
    interactedMem = sessionStorage.getItem(INTERACTED_KEY) === '1';
  } catch {
    interactedMem = false;
  }
  return interactedMem;
}

/** Primeira visita absoluta deste navegador (persiste no localStorage). */
export function isFirstEverVisit(): boolean {
  if (firstVisitMem !== undefined) return !firstVisitMem;
  try {
    firstVisitMem = localStorage.getItem(FIRST_VISIT_KEY);
  } catch {
    firstVisitMem = null;
  }
  return !firstVisitMem;
}

export function markFirstVisitSeen(): void {
  if (firstVisitMem) return; // já gravado → noop no hot path
  // Hidrata se ainda não consultamos
  if (firstVisitMem === undefined) {
    try { firstVisitMem = localStorage.getItem(FIRST_VISIT_KEY); } catch { firstVisitMem = null; }
    if (firstVisitMem) return;
  }
  firstVisitMem = String(Date.now());
  requestFlush();
}


/**
 * Avalia se um popup automático pode disparar agora.
 * - Em primeira visita absoluta: bloqueia até o usuário interagir.
 * - Sempre exige scroll mínimo OU (tempo mínimo + interação se requireInteraction).
 */
export function canTriggerMarketingPopup(
  mountedAt: number,
  thresholds: PopupThresholds = getConservativeThresholds(),
): boolean {
  // Regra 1ª visita: bloqueia tudo até qualquer interação acontecer.
  if (isFirstEverVisit() && !hasInteracted()) return false;

  const elapsed = Date.now() - mountedAt;
  const scrollOk = hasReachedScrollThreshold(thresholds.scrollPct);
  const timeOk = elapsed >= thresholds.minTimeMs;

  if (scrollOk) return true;
  if (timeOk) {
    return thresholds.requireInteraction ? hasInteracted() : true;
  }
  return false;
}

/**
 * Instala listeners globais idempotentes para marcar interação e fechar a
 * marca de "primeira visita" assim que o usuário interagir.
 * Chamar 1× no bootstrap (App.tsx).
 */
let installed = false;
export function installPopupGuards(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const onAny = () => {
    markInteracted();
    markFirstVisitSeen();
  };

  window.addEventListener('scroll', onAny, { passive: true });
  window.addEventListener('click', onAny, { passive: true });
  window.addEventListener('keydown', onAny);
  window.addEventListener('touchstart', onAny, { passive: true });
}
