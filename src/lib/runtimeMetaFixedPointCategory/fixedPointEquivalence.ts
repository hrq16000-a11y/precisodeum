/**
 * Fase 1.9.11 — Equivalence classes (symmetric/transitive).
 */

import { deepFreeze } from './fixedPointCategory';
import type {
  FpcEquivalence,
  FpcEquivalenceKind,
  FpcResolution,
} from './fixedPointCategoryTypes';

export function buildEquivalence(res: FpcResolution): FpcEquivalence {
  const buckets = new Map<string, string[]>();
  for (const fp of res.fixedPoints) {
    const key = `${fp.convergenceClass}|${fp.iterations}|${fp.cycle ? 'c' : 's'}`;
    const list = buckets.get(key) ?? [];
    list.push(fp.id);
    buckets.set(key, list);
  }
  const classes: string[][] = [];
  for (const [, ids] of buckets) classes.push([...ids].sort());
  classes.sort((a, b) => a.join(',').localeCompare(b.join(',')));

  // Symmetric: per construction (equivalence by class label). Transitive: same.
  const symmetric = true;
  const transitive = true;

  let kind: FpcEquivalenceKind;
  if (res.unreachable.length > 0) kind = 'invalid';
  else if (res.cycles.length > 0) kind = 'recursive';
  else if (res.fixedPoints.every((f) => f.stable)) kind = 'exact';
  else if (res.fixedPoints.some((f) => f.diverged)) kind = 'convergent';
  else kind = 'structural';

  return deepFreeze({
    classes: Object.freeze(classes.map((c) => Object.freeze(c))),
    kind,
    symmetric,
    transitive,
  });
}
