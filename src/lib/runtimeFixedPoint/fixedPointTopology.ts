/**
 * Fase 1.9.1 — Fixed-Point topology (READ-ONLY).
 */

import type {
  FixedPointResolution,
  FixedPointTopology,
  FixedPointTopologyMode,
} from './fixedPointTypes';

export function buildFixedPointTopology(
  resolution: FixedPointResolution,
): FixedPointTopology {
  return Object.freeze({
    mode: classifyTopologyConvergence(resolution),
    oscillating: detectTopologyOscillation(resolution),
    recursive: detectRecursiveTopology(resolution),
    collapsed: detectTopologyCollapse(resolution),
    unreachable: detectUnreachableEquilibrium(resolution),
  });
}

export function detectRecursiveTopology(
  resolution: FixedPointResolution,
): boolean {
  return resolution.loops.length > 0;
}

export function detectTopologyOscillation(
  resolution: FixedPointResolution,
): boolean {
  return resolution.fixedPoints.some(
    (f) => f.class === 'unstable' && f.states.length > 1,
  );
}

export function detectTopologyCollapse(
  resolution: FixedPointResolution,
): boolean {
  return resolution.impossible.length > 0;
}

export function detectUnreachableEquilibrium(
  resolution: FixedPointResolution,
): boolean {
  return (
    resolution.fixedPoints.length > 0 &&
    resolution.fixedPoints.every((f) => !f.stable)
  );
}

export function classifyTopologyConvergence(
  resolution: FixedPointResolution,
): FixedPointTopologyMode {
  if (detectTopologyCollapse(resolution)) return 'collapsing';
  if (detectUnreachableEquilibrium(resolution)) return 'unreachable';
  if (detectTopologyOscillation(resolution)) return 'oscillating';
  if (detectRecursiveTopology(resolution)) return 'recursive';
  return 'stable';
}
