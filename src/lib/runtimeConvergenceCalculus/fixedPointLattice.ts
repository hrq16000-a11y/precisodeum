/**
 * Fase 1.9.2 — Fixed-point lattice (READ-ONLY, deterministic).
 */

import type {
  ConvergenceClass,
  ConvergenceNode,
  ConvergenceSpace,
  ResolutionFixedPoint,
} from './convergenceTypes';

const MAX_ITERATIONS = 64;

function indexById(nodes: readonly ConvergenceNode[]): ReadonlyMap<string, ConvergenceNode> {
  const m = new Map<string, ConvergenceNode>();
  for (const n of nodes) m.set(n.id, n);
  return m;
}

export function calculateResolutionDepth(
  space: ConvergenceSpace,
  startId: string,
): number {
  const map = indexById(space.nodes);
  let cur = map.get(startId);
  let depth = 0;
  const seen = new Set<string>();
  while (cur && depth < MAX_ITERATIONS) {
    if (seen.has(cur.id)) return depth;
    seen.add(cur.id);
    const next = cur.successors[0];
    if (!next) return depth;
    cur = map.get(next);
    depth += 1;
  }
  return depth;
}

export function detectFixedPointCycles(
  space: ConvergenceSpace,
): readonly (readonly string[])[] {
  const map = indexById(space.nodes);
  const visited = new Set<string>();
  const cycles: string[][] = [];

  for (const start of space.nodes) {
    if (visited.has(start.id)) continue;
    const path: string[] = [];
    const indexInPath = new Map<string, number>();
    let cur: ConvergenceNode | undefined = start;
    let steps = 0;
    while (cur && steps < MAX_ITERATIONS) {
      if (indexInPath.has(cur.id)) {
        const at = indexInPath.get(cur.id)!;
        cycles.push(Object.freeze([...path.slice(at)]) as unknown as string[]);
        break;
      }
      indexInPath.set(cur.id, path.length);
      path.push(cur.id);
      visited.add(cur.id);
      const next = cur.successors[0];
      cur = next ? map.get(next) : undefined;
      steps += 1;
    }
  }
  return Object.freeze(cycles.map((c) => Object.freeze(c)));
}

export function detectNonConvergentResolution(space: ConvergenceSpace): boolean {
  const map = indexById(space.nodes);
  for (const start of space.nodes) {
    let cur: ConvergenceNode | undefined = start;
    let prev = -Infinity;
    let steps = 0;
    let increasing = 0;
    while (cur && steps < MAX_ITERATIONS) {
      if (cur.value > prev) increasing += 1;
      prev = cur.value;
      const next = cur.successors[0];
      cur = next ? map.get(next) : undefined;
      steps += 1;
    }
    if (steps >= MAX_ITERATIONS && increasing >= MAX_ITERATIONS / 2) return true;
  }
  return false;
}

export function classifyFixedPoint(
  iterations: number,
  cycle: boolean,
  diverged: boolean,
): ConvergenceClass {
  if (diverged) return 'DIVERGENT';
  if (cycle) return 'OSCILLATING';
  if (iterations === 0) return 'STABLE';
  if (iterations >= MAX_ITERATIONS) return 'COLLAPSING';
  return 'EVENTUAL';
}

export function resolveFixedPoint(
  space: ConvergenceSpace,
  startId: string,
): ResolutionFixedPoint {
  const map = indexById(space.nodes);
  const path: string[] = [];
  const indexInPath = new Map<string, number>();
  let cur = map.get(startId);
  let steps = 0;
  let cycle = false;
  let prev = -Infinity;
  let diverged = false;
  let increasingHits = 0;

  while (cur && steps < MAX_ITERATIONS) {
    if (indexInPath.has(cur.id)) {
      cycle = true;
      break;
    }
    indexInPath.set(cur.id, path.length);
    path.push(cur.id);
    if (cur.value > prev) increasingHits += 1;
    prev = cur.value;
    const next = cur.successors[0];
    if (!next) break;
    cur = map.get(next);
    steps += 1;
  }
  if (steps >= MAX_ITERATIONS && increasingHits >= MAX_ITERATIONS / 2) {
    diverged = true;
  }
  const classification = classifyFixedPoint(steps, cycle, diverged);
  return Object.freeze({
    id: startId,
    members: Object.freeze([...path]),
    iterations: steps,
    stable: !cycle && !diverged && steps < MAX_ITERATIONS,
    classification,
  });
}

export function resolveAllFixedPoints(
  space: ConvergenceSpace,
): readonly ResolutionFixedPoint[] {
  return Object.freeze(space.nodes.map((n) => resolveFixedPoint(space, n.id)));
}
