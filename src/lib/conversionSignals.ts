/**
 * FASE 2.6 — Conversion Signals Layer
 *
 * Score determinístico e auditável a partir dos sinais reais já coletados:
 *  - profile_views (audit_log/public_funnel)
 *  - whatsapp_clicks + phone_clicks (contact_clicks)
 *  - lead_submits (audit_log/public_funnel)
 *
 * SEM ML, SEM IA, SEM black-box. Pesos visíveis. Reversível em runtime.
 *
 * Bucketização evita score frágil absoluto:
 *   high_conversion   → top performers (CTR≥20% ou lead_rate≥5%)
 *   medium_conversion → CTR≥10% ou lead_rate≥2%
 *   low_conversion    → views ≥10 mas conversão baixa
 *   unknown           → menos de 10 views (sample insuficiente)
 */

export interface ProviderConversionStats {
  provider_id: string;
  profile_views: number;
  whatsapp_clicks: number;
  phone_clicks: number;
  lead_submits: number;
  ctr_view_to_contact: number; // 0..1
  lead_rate: number;           // 0..1
}

export type ConversionBucket =
  | 'high_conversion'
  | 'medium_conversion'
  | 'low_conversion'
  | 'unknown';

/** Mínimo de views para classificar (evita ruído estatístico). */
export const MIN_VIEWS_FOR_BUCKET = 10;

/**
 * Pesos do score (auditáveis). Não usar em ranking absoluto — usar `bucket`.
 */
export const CONVERSION_WEIGHTS = {
  lead_rate: 100,
  ctr: 40,
  whatsapp_share: 15,
  sponsor_bonus: 5,
  premium_bonus: 3,
} as const;

/** Multiplicador leve por bucket — usado no reorder de busca. */
export const BUCKET_MULTIPLIER: Record<ConversionBucket, number> = {
  high_conversion: 1.15,
  medium_conversion: 1.05,
  low_conversion: 0.95,
  unknown: 1.0,
};

export function bucketize(stats: ProviderConversionStats): ConversionBucket {
  if (!stats || stats.profile_views < MIN_VIEWS_FOR_BUCKET) return 'unknown';
  if (stats.lead_rate >= 0.05 || stats.ctr_view_to_contact >= 0.20) return 'high_conversion';
  if (stats.lead_rate >= 0.02 || stats.ctr_view_to_contact >= 0.10) return 'medium_conversion';
  return 'low_conversion';
}

export interface ProviderScoreInput {
  stats?: ProviderConversionStats | null;
  hasActiveSponsor?: boolean;
  isPremium?: boolean;
}

/**
 * Score leve, determinístico e limitado. Útil só para tie-break secundário.
 * NÃO substitui o ranking principal (que já vive na RPC `nearby_providers`).
 */
export function getProviderConversionScore(input: ProviderScoreInput): number {
  const s = input.stats;
  if (!s || s.profile_views < MIN_VIEWS_FOR_BUCKET) {
    return input.hasActiveSponsor ? CONVERSION_WEIGHTS.sponsor_bonus : 0;
  }
  const contacts = s.whatsapp_clicks + s.phone_clicks;
  const whatsappShare = contacts > 0 ? s.whatsapp_clicks / contacts : 0;
  let score =
    s.lead_rate * CONVERSION_WEIGHTS.lead_rate +
    s.ctr_view_to_contact * CONVERSION_WEIGHTS.ctr +
    whatsappShare * CONVERSION_WEIGHTS.whatsapp_share;
  if (input.hasActiveSponsor) score += CONVERSION_WEIGHTS.sponsor_bonus;
  if (input.isPremium) score += CONVERSION_WEIGHTS.premium_bonus;
  // Clamp para evitar dominância
  return Math.max(0, Math.min(50, score));
}

/**
 * Garante diversidade: limita exposição consecutiva do mesmo provider.
 * Hoje a busca já é por provider único, mas a função fica pronta para
 * quando misturarmos serviços ou recomendações.
 */
export function applyDiversityCap<T extends { providerId?: string; provider_id?: string; user_id?: string; id?: string }>(
  list: T[],
  maxSameProviderInRow = 2,
): T[] {
  if (!list || list.length <= 2) return list;
  const out: T[] = [];
  let lastKey: string | null = null;
  let streak = 0;
  const queue = [...list];
  while (queue.length > 0) {
    const idx = queue.findIndex((item) => {
      const k = item.providerId || item.provider_id || item.user_id || item.id || '';
      if (k !== lastKey) return true;
      return streak < maxSameProviderInRow;
    });
    const pickIdx = idx === -1 ? 0 : idx;
    const picked = queue.splice(pickIdx, 1)[0];
    const k = picked.providerId || picked.provider_id || picked.user_id || picked.id || '';
    if (k === lastKey) streak++;
    else { lastKey = k; streak = 1; }
    out.push(picked);
  }
  return out;
}
