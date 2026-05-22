/**
 * FASE 1.8 — Delivery Health Enforcement (fail-closed).
 *
 * Espelha em runtime as regras determinísticas da RPC
 * `public.get_sponsor_health_status` (Fase 1.7). Esta função NÃO
 * faz chamada ao backend: aplica os mesmos critérios sobre os
 * campos já carregados (`select('*')` em sponsors), garantindo
 * defesa em profundidade sem custo de rede e sem N+1.
 *
 * Bloqueia (não renderiza): expired | incomplete | inconsistent | blocked
 * Permite: healthy | warning
 * Fail-closed: qualquer campo essencial inválido => não renderiza.
 */

export type SponsorHealthStatus =
  | 'healthy'
  | 'warning'
  | 'expired'
  | 'incomplete'
  | 'inconsistent'
  | 'blocked'
  | 'unknown';

interface DeliveryCandidate {
  id?: string | null;
  status?: string | null;
  active?: boolean | null;
  sponsor_type?: string | null;
  linked_city_slug?: string | null;
  linked_category_slug?: string | null;
  image_url?: string | null;
  logo_url?: string | null;
  campaign_end?: string | null;
  end_date?: string | null;
  pacing_status?: string | null;
}

function isExpired(s: DeliveryCandidate): boolean {
  const now = Date.now();
  if (s.campaign_end) {
    const t = Date.parse(s.campaign_end);
    if (!Number.isNaN(t) && t < now) return true;
  }
  if (s.end_date) {
    const t = Date.parse(s.end_date);
    if (!Number.isNaN(t) && t < now) return true;
  }
  return false;
}

function hasAsset(s: DeliveryCandidate): boolean {
  const a = (s.image_url || '').trim();
  const b = (s.logo_url || '').trim();
  return a.length > 0 || b.length > 0;
}

function scopeOk(s: DeliveryCandidate): boolean {
  if (s.sponsor_type === 'city') {
    return Boolean(s.linked_city_slug && s.linked_city_slug.length > 0);
  }
  if (s.sponsor_type === 'category') {
    return Boolean(s.linked_category_slug && s.linked_category_slug.length > 0);
  }
  return true;
}

/** Resolve health status determinístico (alinhado à RPC server-side). */
export function resolveSponsorHealthStatus(s: DeliveryCandidate | null | undefined): SponsorHealthStatus {
  if (!s || !s.id) return 'unknown';
  if (s.status === 'rejected') return 'blocked';
  if (isExpired(s)) return 'expired';
  if (!scopeOk(s)) return 'inconsistent';
  if (!hasAsset(s)) return 'incomplete';
  if (s.pacing_status === 'critical' || s.status === 'pending_approval') return 'warning';
  return 'healthy';
}

/** True se o sponsor pode ser entregue publicamente. Fail-closed. */
export function isSponsorDeliverable(s: DeliveryCandidate | null | undefined): boolean {
  const h = resolveSponsorHealthStatus(s);
  return h === 'healthy' || h === 'warning';
}

/* ------------------------------------------------------------------ */
/* Observabilidade leve — amostragem (1%) via console.debug.          */
/* Sem flood, sem chamada de rede. Apenas em DEV.                     */
/* ------------------------------------------------------------------ */
const _logged = new Set<string>();
export function logBlockedSponsor(slot: string, s: DeliveryCandidate, reason: SponsorHealthStatus) {
  if (typeof window === 'undefined') return;
  if (!(import.meta as any)?.env?.DEV) return;
  const key = `${slot}:${s.id}:${reason}`;
  if (_logged.has(key)) return;
  if (Math.random() > 0.01) return;
  _logged.add(key);
  // eslint-disable-next-line no-console
  console.debug('[sponsor-delivery-guard] blocked', { slot, sponsorId: s.id, reason });
}
