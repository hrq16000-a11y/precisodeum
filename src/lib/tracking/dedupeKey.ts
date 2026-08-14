/**
 * FASE A · Chaves de idempotência para eventos de tracking.
 *
 * Objetivo: um mesmo evento lógico (impressão, clique, search intent, funil)
 * nunca deve ser contado duas vezes por causa de:
 *  - re-render / StrictMode duplo-mount do React
 *  - retry de rede
 *  - refresh / back-forward cache
 *
 * A chave é estável dentro de uma janela de tempo (bucket) e é enviada ao
 * servidor, que faz o dedupe definitivo em `tracking_event_dedupe`.
 */

export type TrackingEventType =
  | 'impression'
  | 'click'
  | 'search_intent'
  | 'funnel';

/** Janela de dedupe por tipo de evento, em minutos. */
export const DEDUPE_WINDOW_MINUTES: Record<TrackingEventType, number> = {
  impression: 30,
  click: 5,
  search_intent: 10,
  funnel: 10,
};

const VISITOR_KEY = 'pdu_visitor_id';

/** Identificador estável do visitante (mesmo usado pelo search intent). */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

/** Hash FNV-1a 32-bit — determinístico, sem dependências. */
export function stableHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * Gera a chave de idempotência.
 * O bucket temporal garante que o mesmo evento repetido dentro da janela
 * produza exatamente a mesma chave.
 */
export function trackingDedupeKey(
  type: TrackingEventType,
  parts: Array<string | number | null | undefined>,
  now: number = Date.now(),
): string {
  const windowMs = DEDUPE_WINDOW_MINUTES[type] * 60_000;
  const bucket = Math.floor(now / windowMs);
  const payload = parts
    .map((p) => (p === null || p === undefined ? '' : String(p).trim().toLowerCase()))
    .join('|');
  return `${type}:${stableHash(`${getVisitorId()}|${payload}|${bucket}`)}`;
}

/* ─── Camada 1: dedupe local (imune a re-render / StrictMode) ─── */

const memory = new Set<string>();

/**
 * Retorna `true` quando o evento é novo e deve ser enviado.
 * Combina Set em memória (mesma sessão de página) com sessionStorage
 * (sobrevive a refresh / back-forward).
 */
export function claimLocalDedupe(key: string): boolean {
  if (memory.has(key)) return false;
  memory.add(key);
  if (typeof window === 'undefined') return true;
  try {
    const storageKey = `trk:${key}`;
    if (sessionStorage.getItem(storageKey)) return false;
    sessionStorage.setItem(storageKey, '1');
  } catch {
    // sessionStorage indisponível — o Set em memória + servidor já protegem
  }
  return true;
}

/** Apenas para testes. */
export function __resetLocalDedupe(): void {
  memory.clear();
}
