/**
 * Fase 1.9.1 — Fixed-Point equivalence (READ-ONLY).
 */

import type {
  FixedPointEquivalence,
  FixedPointResolution,
  RuntimeFixedPoint,
} from './fixedPointTypes';

function classKey(fp: RuntimeFixedPoint): string {
  return `${fp.class}|${fp.states.length}`;
}

export function resolveEquivalentFixedPoints(
  resolution: FixedPointResolution,
): readonly (readonly string[])[] {
  const map = new Map<string, string[]>();
  for (const fp of resolution.fixedPoints) {
    const k = classKey(fp);
    const arr = map.get(k) ?? [];
    arr.push(fp.id);
    map.set(k, arr);
  }
  return Object.freeze(
    Array.from(map.values()).map((arr) => Object.freeze([...arr])),
  );
}

export function classifyFixedPointEquivalence(
  resolution: FixedPointResolution,
): FixedPointEquivalence['kind'] {
  if (resolution.impossible.length > 0) return 'invalid';
  if (resolution.loops.length > 0) return 'recursive';
  if (resolution.fixedPoints.every((f) => f.class === 'stable')) return 'exact';
  if (resolution.fixedPoints.every((f) => f.stable)) return 'convergent';
  return 'structural';
}

export function reduceEquivalentRecursions(
  classes: readonly (readonly string[])[],
): readonly string[] {
  return Object.freeze(classes.map((c) => c[0]).filter(Boolean));
}

export function detectFalseConvergence(
  resolution: FixedPointResolution,
): boolean {
  return resolution.fixedPoints.some(
    (f) => f.stable && f.iterations > 8 && f.class !== 'stable',
  );
}

export function detectRecursiveEquivalence(
  classes: readonly (readonly string[])[],
): boolean {
  return classes.some((c) => c.length > 1);
}

export function aggregateEquivalenceHealth(
  resolution: FixedPointResolution,
): FixedPointEquivalence {
  const classes = resolveEquivalentFixedPoints(resolution);
  return Object.freeze({
    classes,
    kind: classifyFixedPointEquivalence(resolution),
    falseConvergence: detectFalseConvergence(resolution),
  });
}
