/**
 * Fase 1.9.11 — Identity morphisms (READ-ONLY).
 */

import { deepFreeze } from './fixedPointCategory';
import type { FpcCategory, FpcIdentity } from './fixedPointCategoryTypes';

export function checkIdentity(cat: FpcCategory): FpcIdentity {
  const identityByObj = new Set<string>();
  for (const m of cat.morphisms) {
    if (m.source === m.target) identityByObj.add(m.source);
  }
  const missing = cat.objects
    .map((o) => o.id)
    .filter((id) => !identityByObj.has(id))
    .sort();
  return deepFreeze({
    identityCount: identityByObj.size,
    missing: Object.freeze(missing),
    canonical: missing.length === 0,
  });
}
