/**
 * Espelho client-side da ordenação aplicada pela RPC `nearby_providers`.
 *
 * Usado para:
 *  - Re-ordenar resultados localmente quando há mistura de fontes (ex.: cache + presence delta)
 *  - Cobrir com testes unitários a estabilidade de tie-break e a normalização de distância,
 *    garantindo o mesmo comportamento documentado no SQL (Online Boost v3).
 *
 * Ordem de prioridade (desc, exceto distância e timestamps que são asc):
 *  1. level_priority   — Featured/Online primeiro
 *  2. visibility_score — Score híbrido calculado pelo RPC
 *  3. engagement_points
 *  4. rating_avg
 *  5. review_count
 *  6. distance_m       (asc — menor distância vence; null vira +Infinity)
 *  7. updated_at       (asc — perfil atualizado primeiro)
 *  8. user_id          (asc — desempate determinístico final)
 */
export interface RankableProvider {
  user_id: string;
  level_priority?: number | null;
  visibility_score?: number | null;
  engagement_points?: number | null;
  rating_avg?: number | null;
  review_count?: number | null;
  distance_m?: number | null;
  updated_at?: string | null;
}

const num = (v: number | null | undefined, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Normaliza distância em metros para um peso 0..1 (1 = mais perto).
 * - null/undefined/NaN → 0 (neutro, não derruba o ranking)
 * - >= maxM → 0
 * - 0 → 1
 * Espelha a expressão `GREATEST(0, 1 - distance_m / maxM)` usada no RPC.
 */
export function normalizeDistance(distanceM: number | null | undefined, maxM = 50000): number {
  if (distanceM == null || !Number.isFinite(distanceM)) return 0;
  if (distanceM <= 0) return 1;
  if (distanceM >= maxM) return 0;
  return Math.max(0, Math.min(1, 1 - distanceM / maxM));
}

const distanceForSort = (v: number | null | undefined): number =>
  v == null || !Number.isFinite(v) ? Number.POSITIVE_INFINITY : v;

const updatedAtForSort = (v: string | null | undefined): number => {
  if (!v) return Number.POSITIVE_INFINITY;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
};

export function compareProviders(a: RankableProvider, b: RankableProvider): number {
  const lp = num(b.level_priority) - num(a.level_priority);
  if (lp !== 0) return lp;

  const vs = num(b.visibility_score) - num(a.visibility_score);
  if (vs !== 0) return vs;

  const ep = num(b.engagement_points) - num(a.engagement_points);
  if (ep !== 0) return ep;

  const ra = num(b.rating_avg) - num(a.rating_avg);
  if (ra !== 0) return ra;

  const rc = num(b.review_count) - num(a.review_count);
  if (rc !== 0) return rc;

  const da = distanceForSort(a.distance_m);
  const db = distanceForSort(b.distance_m);
  if (da !== db) return da - db;

  const ua = updatedAtForSort(a.updated_at);
  const ub = updatedAtForSort(b.updated_at);
  if (ua !== ub) return ua - ub;

  // último desempate: user_id (string compare) — 100% determinístico
  return String(a.user_id).localeCompare(String(b.user_id));
}

export function sortProvidersStable<T extends RankableProvider>(list: T[]): T[] {
  // Array.prototype.sort no V8 já é estável (TimSort), mas reforçamos via id final.
  return [...list].sort(compareProviders);
}
