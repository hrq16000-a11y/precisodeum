/**
 * Fase 1.9.11 — Fixed-point closure (READ-ONLY).
 */

import { deepFreeze, fpcSignature } from './fixedPointCategory';
import type { FpcCategory, FpcClosure, FpcResolution } from './fixedPointCategoryTypes';

export function buildClosure(cat: FpcCategory, res: FpcResolution): FpcClosure {
  const reachable = new Set<string>();
  for (const fp of res.fixedPoints) for (const p of fp.path) reachable.add(p);
  const missing = cat.objects
    .map((o) => o.id)
    .filter((id) => !reachable.has(id))
    .sort();
  const closed = missing.length === 0 && res.unreachable.length === 0;
  const signature = fpcSignature({
    closed,
    missing,
    catSig: cat.signature,
  });
  return deepFreeze({
    closed,
    missing: Object.freeze(missing),
    signature,
  });
}
