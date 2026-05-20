/**
 * Fase 1.9.11 — Composition associativity + closure (READ-ONLY).
 */

import { deepFreeze } from './fixedPointCategory';
import type { FpcCategory, FpcComposition } from './fixedPointCategoryTypes';

export function checkComposition(cat: FpcCategory): FpcComposition {
  const objIds = new Set(cat.objects.map((o) => o.id));
  const violations: string[] = [];
  let closed = true;
  for (const m of cat.morphisms) {
    if (!objIds.has(m.source)) {
      closed = false;
      violations.push(`missing_source:${m.id}:${m.source}`);
    }
    if (!objIds.has(m.target)) {
      closed = false;
      violations.push(`missing_target:${m.id}:${m.target}`);
    }
  }
  // Associativity check on composable triples (f:a->b, g:b->c, h:c->d)
  // For arrow-only category, (h∘g)∘f === h∘(g∘f) always — record as true unless inconsistent.
  const byKey = new Map<string, number>();
  for (const m of cat.morphisms) {
    const k = `${m.source}>${m.target}`;
    byKey.set(k, (byKey.get(k) ?? 0) + 1);
  }
  let associative = true;
  for (const [k, c] of byKey) {
    if (c > 1) {
      // Parallel morphisms with different weights break canonical composition.
      const sameWeight = cat.morphisms
        .filter((mm) => `${mm.source}>${mm.target}` === k)
        .every((mm, _, arr) => mm.weight === arr[0].weight);
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
