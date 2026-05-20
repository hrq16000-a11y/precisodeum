/**
 * Fase 1.9.12 — Recursive identity (READ-ONLY, idempotent).
 */

import { deepFreeze } from './recursiveEquilibrium';
import type { ReqIdentity, ReqSystem } from './recursiveEquilibriumTypes';

export function checkRecursiveIdentity(sys: ReqSystem): ReqIdentity {
  const self = new Set<string>();
  for (const e of sys.edges) if (e.source === e.target) self.add(e.source);
  const missing = sys.nodes
    .map((n) => n.id)
    .filter((id) => !self.has(id))
    .sort();
  const canonical = missing.length === 0;
  // Idempotent if every self-edge has weight 1 (canonical identity weight).
  const idempotent =
    canonical &&
    sys.edges.filter((e) => e.source === e.target).every((e) => e.weight === 1);
  return deepFreeze({
    identityCount: self.size,
    missing: Object.freeze(missing),
    canonical,
    idempotent,
  });
}
