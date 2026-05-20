/**
 * Fase 1.9.2 — Divergence topology (READ-ONLY).
 */

import type {
  ConvergenceSpace,
  DivergenceSeverity,
  DivergenceTopology,
  ResolutionFixedPoint,
} from './convergenceTypes';

export function detectRecursiveDivergence(
  fps: readonly ResolutionFixedPoint[],
): boolean {
  return fps.some(
    (f) => f.classification === 'OSCILLATING' && f.members.length >= 3,
  );
}

export function detectCrossLayerDivergence(
  space: ConvergenceSpace,
  fps: readonly ResolutionFixedPoint[],
): boolean {
  const layerById = new Map<string, string>();
  for (const n of space.nodes) layerById.set(n.id, n.layer);
  for (const fp of fps) {
    const layers = new Set<string>();
    for (const m of fp.members) {
      const l = layerById.get(m);
      if (l) layers.add(l);
    }
    if (
      layers.size > 1 &&
      (fp.classification === 'DIVERGENT' || fp.classification === 'COLLAPSING')
    ) {
      return true;
    }
  }
  return false;
}

export function detectTopologyFragmentation(
  space: ConvergenceSpace,
): boolean {
  if (space.nodes.length <= 1) return false;
  const totalEdges = space.nodes.reduce((a, n) => a + n.successors.length, 0);
  if (totalEdges === 0) return false; // independent terminal nodes: not fragmented
  const ids = new Set(space.nodes.map((n) => n.id));
  const reachable = new Set<string>();
  const stack = [space.nodes[0].id];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (reachable.has(cur)) continue;
    reachable.add(cur);
    const n = space.nodes.find((x) => x.id === cur);
    if (!n) continue;
    for (const s of n.successors) if (ids.has(s)) stack.push(s);
  }
  return reachable.size < ids.size;
}

export function calculateDivergenceRadius(
  fps: readonly ResolutionFixedPoint[],
): number {
  let max = 0;
  for (const f of fps) {
    if (f.classification === 'DIVERGENT' || f.classification === 'COLLAPSING') {
      max = Math.max(max, f.iterations);
    }
  }
  return max;
}

export function classifyDivergenceSeverity(
  radius: number,
  recursive: boolean,
  crossLayer: boolean,
  fragmented: boolean,
): DivergenceSeverity {
  let score = 0;
  if (radius >= 64) score += 3;
  else if (radius >= 32) score += 2;
  else if (radius >= 16) score += 1;
  if (recursive) score += 2;
  if (crossLayer) score += 2;
  if (fragmented) score += 2;
  if (score === 0) return 'NONE';
  if (score <= 2) return 'LOW';
  if (score <= 4) return 'MEDIUM';
  if (score <= 6) return 'HIGH';
  return 'CRITICAL';
}

export function buildDivergenceTopology(
  space: ConvergenceSpace,
  fps: readonly ResolutionFixedPoint[],
): DivergenceTopology {
  const recursive = detectRecursiveDivergence(fps);
  const crossLayer = detectCrossLayerDivergence(space, fps);
  const fragmented = detectTopologyFragmentation(space);
  const radius = calculateDivergenceRadius(fps);
  const severity = classifyDivergenceSeverity(
    radius,
    recursive,
    crossLayer,
    fragmented,
  );
  return Object.freeze({ severity, recursive, crossLayer, fragmented, radius });
}
