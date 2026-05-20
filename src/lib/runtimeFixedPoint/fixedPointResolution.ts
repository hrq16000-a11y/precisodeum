/**
 * Fase 1.9.1 — Fixed-Point resolution (READ-ONLY, deterministic).
 */

import type {
  FixedPointClass,
  FixedPointResolution,
  FixedPointState,
  RuntimeFixedPoint,
} from './fixedPointTypes';

const MAX_ITERATIONS = 64;

function signatureOf(state: FixedPointState): string {
  return [
    state.layer,
    state.stage,
    state.liveExecutionEnabled ? '1' : '0',
    state.retryEnabled ? '1' : '0',
    state.backgroundEnabled ? '1' : '0',
    state.realUsersAllowed ? '1' : '0',
  ].join('|');
}

export function resolveFixedPoints(
  states: readonly FixedPointState[],
): FixedPointResolution {
  const buckets = new Map<string, FixedPointState[]>();
  for (const s of states) {
    const k = signatureOf(s);
    const arr = buckets.get(k) ?? [];
    arr.push(s);
    buckets.set(k, arr);
  }
  const fixedPoints: RuntimeFixedPoint[] = [];
  const loops: string[] = [];
  const unstable: string[] = [];
  const impossible: string[] = [];

  let idx = 0;
  for (const [sig, group] of buckets) {
    const cls = classifyFixedPoint(group);
    const fp: RuntimeFixedPoint = Object.freeze({
      id: `fp:${idx++}:${sig}`,
      states: Object.freeze([...group]),
      class: cls,
      iterations: Math.min(group.length, MAX_ITERATIONS),
      stable: cls === 'stable' || cls === 'convergent',
    });
    fixedPoints.push(fp);
    if (cls === 'recursive') loops.push(fp.id);
    if (cls === 'unstable' || cls === 'divergent') unstable.push(fp.id);
    if (cls === 'impossible') impossible.push(fp.id);
  }

  return Object.freeze({
    fixedPoints: Object.freeze(fixedPoints),
    loops: Object.freeze(loops),
    unstable: Object.freeze(unstable),
    impossible: Object.freeze(impossible),
  });
}

export function detectFixedPointLoops(
  resolution: FixedPointResolution,
): readonly string[] {
  return resolution.loops;
}

export function classifyFixedPoint(
  group: readonly FixedPointState[],
): FixedPointClass {
  if (group.length === 0) return 'impossible';
  const first = group[0];
  if (
    first.liveExecutionEnabled ||
    first.retryEnabled ||
    first.backgroundEnabled ||
    first.realUsersAllowed ||
    first.stage !== 'STAGE_0_READ_ONLY'
  ) {
    return 'impossible';
  }
  if (group.length === 1) return 'stable';
  // Same signature repeated => convergent
  const sig = signatureOf(first);
  const allSame = group.every((s) => signatureOf(s) === sig);
  if (!allSame) return 'unstable';
  if (group.length > MAX_ITERATIONS) return 'divergent';
  if (group.length > 8) return 'recursive';
  return 'convergent';
}

export function detectUnstableResolution(
  resolution: FixedPointResolution,
): boolean {
  return resolution.unstable.length > 0;
}

export function detectInfiniteResolution(
  resolution: FixedPointResolution,
): boolean {
  return resolution.fixedPoints.some((f) => f.iterations >= MAX_ITERATIONS);
}

export function aggregateResolutionHealth(
  resolution: FixedPointResolution,
): { stable: boolean; total: number; stableCount: number } {
  const total = resolution.fixedPoints.length;
  const stableCount = resolution.fixedPoints.filter((f) => f.stable).length;
  return Object.freeze({
    stable:
      total > 0 &&
      stableCount === total &&
      resolution.impossible.length === 0 &&
      resolution.unstable.length === 0,
    total,
    stableCount,
  });
}
