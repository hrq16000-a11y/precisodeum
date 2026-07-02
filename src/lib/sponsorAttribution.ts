/**
 * Fase 2.3 — Atribuição leve de sponsor → funil público.
 *
 * Quando o usuário clica num card sponsor, gravamos {sponsor_id, slot, ts} em
 * sessionStorage. Os eventos seguintes do public_funnel (profile_view,
 * lead_submit) consultam essa entrada (janela 30 min) e enviam `sponsor_ref`
 * para a RPC `record_public_funnel_event`, que arquiva no `audit_log`.
 *
 * Sem fingerprinting, sem cookies persistentes, sem PII.
 */

const KEY = 'sa:last_click';
const TTL_MS = 30 * 60 * 1000;

interface Attribution {
  sponsor_id: string;
  slot: string;
  ts: number;
}

/** Registra um clique sponsor (origem da atribuição). */
export function recordSponsorClick(sponsorId: string, slot: string): void {
  if (typeof window === 'undefined') return;
  if (!sponsorId) return;
  try {
    const payload: Attribution = { sponsor_id: sponsorId, slot, ts: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* silent */
  }
}

/** Retorna sponsor_id ativo se houver clique recente (<=30 min); senão null. */
export function getActiveSponsorRef(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Attribution;
    if (!parsed?.sponsor_id || !parsed?.ts) return null;
    if (Date.now() - parsed.ts > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed.sponsor_id;
  } catch {
    return null;
  }
}

/** Util de testes — não usar em runtime. */
export function __resetSponsorAttribution() {
  try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
}
