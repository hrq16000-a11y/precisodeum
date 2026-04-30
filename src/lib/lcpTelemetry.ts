/**
 * lcpTelemetry — instrumentação leve para medir o impacto do blur-up
 * no LCP/CLS e nos tempos de carregamento das variantes (thumb vs medium).
 *
 * - Loga via RPC `log_query_telemetry` (já existente) com label `image_load`.
 * - Observa `largest-contentful-paint` e `layout-shift` via PerformanceObserver
 *   uma única vez por sessão (sessionStorage gate) e envia 1 sample por métrica.
 * - Fire-and-forget: nunca bloqueia render. Tolerante a navegador sem suporte.
 *
 * Privacidade: não envia URL completa — apenas hostname + path-prefix (até 80
 * chars) para correlacionar bucket/categoria sem expor identificadores.
 */

import { supabase } from '@/integrations/supabase/client';

type Variant = 'thumb' | 'medium' | 'original' | 'unknown';

const SESSION_KEY_VITALS = 'lcp_telemetry_vitals_sent_v1';

function shortUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    const path = u.pathname.length > 80 ? `${u.pathname.slice(0, 77)}...` : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return String(url).slice(0, 80);
  }
}

function logRow(label: string, durationMs: number, meta: Record<string, unknown>) {
  try {
    void Promise.resolve(
      supabase.rpc('log_query_telemetry', {
        _label: label.slice(0, 64),
        _duration_ms: Math.max(0, Math.min(600000, Math.round(durationMs))),
        _rows: null,
        _meta: meta as never,
      }),
    ).then(
      () => undefined,
      () => undefined,
    );
  } catch {
    // noop
  }
}

export interface ImageLoadSample {
  variant: Variant;
  url: string | null;
  durationMs: number;
  /** "blur-up" | "legacy" | "no-variants" */
  mode?: string;
  /** opcional: contexto do call-site (ex: "company-card", "portfolio-grid") */
  surface?: string;
  /** dimensão renderizada (px), útil para correlacionar variant vs viewport */
  renderedWidth?: number | null;
}

/**
 * Registra o tempo de carregamento de uma imagem (thumb ou medium/original).
 * Chamar de dentro do onLoad do <img>.
 */
export function logImageLoad(sample: ImageLoadSample) {
  logRow('image_load', sample.durationMs, {
    variant: sample.variant,
    mode: sample.mode ?? 'unknown',
    surface: sample.surface ?? null,
    rendered_width: sample.renderedWidth ?? null,
    url_short: shortUrl(sample.url),
    effective_type:
      // navigator.connection só existe em Chromium
      (typeof navigator !== 'undefined' &&
        // @ts-expect-error - vendor API
        navigator.connection?.effectiveType) ||
      null,
  });
}

/**
 * Observa LCP e CLS uma única vez por sessão e loga ambos. Idempotente:
 * chamadas subsequentes são no-op (gate via sessionStorage).
 *
 * Deve ser chamado o mais cedo possível no boot (ex: <App> mount).
 */
export function startWebVitalsCapture() {
  if (typeof window === 'undefined') return;
  if (typeof PerformanceObserver === 'undefined') return;

  let alreadySent = false;
  try {
    if (sessionStorage.getItem(SESSION_KEY_VITALS) === '1') return;
  } catch {
    // sessionStorage indisponível → segue mesmo assim
  }

  // ---- LCP ----
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry & {
        renderTime?: number;
        loadTime?: number;
        url?: string;
        size?: number;
      };
      if (!last) return;
      const lcpMs = last.renderTime || last.loadTime || last.startTime;
      logRow('web_vital.lcp', lcpMs, {
        url_short: shortUrl(last.url ?? null),
        size: last.size ?? null,
        path: window.location.pathname,
      });
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // noop
  }

  // ---- CLS ----
  try {
    let cls = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { value: number; hadRecentInput?: boolean }
      >) {
        if (!entry.hadRecentInput) {
          cls += entry.value;
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    // Envia o CLS final ao trocar para "hidden" (mais confiável que beforeunload)
    const finalize = () => {
      if (alreadySent) return;
      alreadySent = true;
      try {
        sessionStorage.setItem(SESSION_KEY_VITALS, '1');
      } catch {
        // noop
      }
      logRow('web_vital.cls', Math.round(cls * 10000), {
        path: window.location.pathname,
        // Convenção: armazenamos *10000 (CLS é entre 0-1+); divisor no leitor.
        cls_x10000: Math.round(cls * 10000),
      });
    };
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') finalize();
      },
      { once: false },
    );
    window.addEventListener('pagehide', finalize, { once: true });
  } catch {
    // noop
  }
}
