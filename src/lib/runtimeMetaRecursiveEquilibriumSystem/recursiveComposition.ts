/**
 * Fase 1.9.12 — Recursive composition (READ-ONLY).
 */

import { deepFreeze } from './recursiveEquilibrium';
import type { ReqComposition, ReqSystem } from './recursiveEquilibriumTypes';

export function checkRecursiveComposition(sys: ReqSystem): ReqComposition {
  const ids = new Set(sys.nodes.map((n) => n.id));
  const violations: string[] = [];
  let closed = true;
  for (const e of sys.edges) {
    if (!ids.has(e.source)) {
      closed = false;
      violations.push(`missing_source:${e.id}:${e.source}`);
    }
    if (!ids.has(e.target)) {
      closed = false;
      violations.push(`missing_target:${e.id}:${e.target}`);
    }
  }
  const byKey = new Map<string, number>();
  for (const e of sys.edges) {
    const k = `${e.source}>${e.target}`;
    byKey.set(k, (byKey.get(k) ?? 0) + 1);
  }
  let associative = true;
  for (const [k, c] of byKey) {
    if (c > 1) {
      const parallel = sys.edges.filter((ee) => `${ee.source}>${ee.target}` === k);
      const sameWeight = parallel.every((ee) => ee.weight === parallel[0].weight);
      if (!sameWeight) {
        associative = false;
        violations.push(`parallel_divergence:${k}`);
      }
    }
  }
  violations.sort();
  return deepFreeze({
    associative,
    closed,
    violations: Object.freeze(violations),
  });
}
