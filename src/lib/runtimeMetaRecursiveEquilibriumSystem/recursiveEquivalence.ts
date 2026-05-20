/**
 * Fase 1.9.12 — Recursive equivalence (symmetric/transitive).
 */

import { deepFreeze } from './recursiveEquilibrium';
import type {
  ReqEquivalence,
  ReqEquivalenceKind,
  ReqResolution,
} from './recursiveEquilibriumTypes';

export function buildRecursiveEquivalence(res: ReqResolution): ReqEquivalence {
  const buckets = new Map<string, string[]>();
  for (const p of res.points) {
    const key = `${p.equilibriumClass}|${p.iterations}|${p.cycle ? 'c' : 's'}|${p.recovered ? 'r' : 'x'}`;
    const list = buckets.get(key) ?? [];
    list.push(p.id);
    buckets.set(key, list);
  }
  const classes: string[][] = [];
  for (const [, ids] of buckets) classes.push([...ids].sort());
  classes.sort((a, b) => a.join(',').localeCompare(b.join(',')));

  // Equivalence-by-class-label: trivially symmetric & transitive.
  const symmetric = true;
  const transitive = true;

  let kind: ReqEquivalenceKind;
  if (res.unreachable.length > 0) kind = 'invalid';
  else if (res.cycles.length > 0) kind = 'recursive';
  else if (res.points.every((p) => p.equilibriumClass === 'STABLE')) kind = 'exact';
  else if (res.points.some((p) => p.diverged)) kind = 'convergent';
  else kind = 'structural';

  return deepFreeze({
    classes: Object.freeze(classes.map((c) => Object.freeze(c))),
    kind,
    symmetric,
    transitive,
  });
}
