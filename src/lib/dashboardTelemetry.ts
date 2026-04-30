/**
 * dashboardTelemetry — métricas leves de UX para o Dashboard.
 *
 * Coleta no cliente (sem PII) e expõe um dispatcher único que tenta enviar
 * para `trackEvent` (lib/tracking) quando disponível. Falhas são silenciosas
 * — telemetria nunca quebra a UI.
 *
 * Métricas suportadas:
 *  - dashboard_load        : ms desde a navegação até o primeiro paint do Dashboard
 *  - dashboard_first_render: ms desde mount até o primeiro frame com dados reais
 *  - dashboard_blocked_click: clique capturado por overlay (pointer-events / z-index)
 *
 * Uso típico:
 *   import { startDashboardTimers, reportFirstRender, attachBlockedClickProbe } from '@/lib/dashboardTelemetry';
 *
 *   useEffect(() => {
 *     const cleanup = startDashboardTimers();
 *     const detach = attachBlockedClickProbe();
 *     return () => { cleanup(); detach(); };
 *   }, []);
 *
 *   useEffect(() => { if (!loading) reportFirstRender(); }, [loading]);
 */

type TelemetryMeta = Record<string, unknown>;

const isBrowser = typeof window !== 'undefined';

let mountTs = 0;
let firstRenderReported = false;

function safeTrack(event: string, meta: TelemetryMeta) {
  try {
    // tracking module pode ou não existir — import dinâmico best-effort
    import('@/lib/tracking')
      .then((mod) => {
        const fn = (mod as any)?.trackEvent;
        if (typeof fn === 'function') {
          fn(event, meta);
        } else if (import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.debug('[dashboardTelemetry]', event, meta);
        }
      })
      .catch(() => {
        if (import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.debug('[dashboardTelemetry]', event, meta);
        }
      });
  } catch {
    /* noop */
  }
}

export function startDashboardTimers() {
  if (!isBrowser) return () => {};
  mountTs = performance.now();
  firstRenderReported = false;

  // Tempo até o load global do dashboard (assets prontos)
  const onLoad = () => {
    safeTrack('dashboard_load', {
      ms: Math.round(performance.now() - mountTs),
      path: window.location.pathname,
    });
  };

  if (document.readyState === 'complete') {
    onLoad();
  } else {
    window.addEventListener('load', onLoad, { once: true });
  }

  return () => {
    window.removeEventListener('load', onLoad);
  };
}

/**
 * Deve ser chamado quando os dados principais do Dashboard estão prontos.
 * Idempotente — só dispara uma vez por mount.
 */
export function reportFirstRender(extra: TelemetryMeta = {}) {
  if (!isBrowser || firstRenderReported || !mountTs) return;
  firstRenderReported = true;
  safeTrack('dashboard_first_render', {
    ms: Math.round(performance.now() - mountTs),
    ...extra,
  });
}

/**
 * Detecta cliques que foram absorvidos por um overlay (elemento com
 * `position: fixed` ou `z-index >= 50` cobrindo o alvo). Útil para flagrar
 * regressões onde modais/backdrops ficam interativos sem fechar.
 *
 * Heurística (mobile-first):
 *  - Em `pointerdown`, captura o elemento alvo.
 *  - Se o elemento topo (via elementFromPoint) é diferente do alvo lógico
 *    detectado por `closest('button,a,[role=button],input,select,textarea')`,
 *    consideramos que houve um overlay capturando o clique.
 */
export function attachBlockedClickProbe(): () => void {
  if (!isBrowser) return () => {};

  const handler = (ev: PointerEvent) => {
    try {
      const path = (ev.composedPath?.() || []) as Element[];
      const interactive = path.find((el) => {
        if (!(el instanceof Element)) return false;
        return !!el.closest?.('button,a,[role="button"],input,select,textarea,[data-interactive]');
      });
      if (!interactive) return;

      const top = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!top) return;

      // Se o topo é o próprio alvo (ou descendente/ancestral), não houve bloqueio.
      if (top === interactive || interactive.contains(top) || top.contains(interactive)) {
        return;
      }

      // Considera bloqueio quando o "topo" tem position fixed/sticky ou z-index alto.
      const style = window.getComputedStyle(top as Element);
      const z = parseInt(style.zIndex, 10);
      const isOverlay =
        style.position === 'fixed' ||
        style.position === 'sticky' ||
        (Number.isFinite(z) && z >= 50);

      if (!isOverlay) return;

      safeTrack('dashboard_blocked_click', {
        target_tag: (interactive as HTMLElement).tagName?.toLowerCase(),
        overlay_tag: (top as HTMLElement).tagName?.toLowerCase(),
        overlay_z: Number.isFinite(z) ? z : null,
        overlay_position: style.position,
        path: window.location.pathname,
      });
    } catch {
      /* silencioso */
    }
  };

  window.addEventListener('pointerdown', handler, { capture: true, passive: true });
  return () => window.removeEventListener('pointerdown', handler, { capture: true } as any);
}
