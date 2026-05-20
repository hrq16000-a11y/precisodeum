/**
 * Fase 1.9.1 — Propagation resolution (READ-ONLY).
 */

import type {
  FixedPointPropagation,
  FixedPointPropagationMode,
  FixedPointResolution,
} from './fixedPointTypes';

const PROPAGATION_LIMIT = 32;

export function buildPropagationResolution(
  resolution: FixedPointResolution,
): FixedPointPropagation {
  const mode = classifyPropagationStability(resolution);
  return Object.freeze({
    mode,
    overflow: detectPropagationOverflow(resolution),
    infinite: detectInfiniteCascade(resolution),
    bounded: mode === 'bounded' || mode === 'stable',
  });
}

export function detectPropagationOverflow(
  resolution: FixedPointResolution,
): boolean {
  return resolution.fixedPoints.some((f) => f.iterations > PROPAGATION_LIMIT);
}

export function detectRecursivePropagation(
  resolution: FixedPointResolution,
): boolean {
  return resolution.loops.length > 0;
}

export function detectInfiniteCascade(
  resolution: FixedPointResolution,
): boolean {
  return resolution.fixedPoints.some(
    (f) => f.class === 'divergent' && f.iterations >= PROPAGATION_LIMIT,
  );
}

export function classifyPropagationStability(
  resolution: FixedPointResolution,
): FixedPointPropagationMode {
  if (detectInfiniteCascade(resolution)) return 'infinite';
  if (detectPropagationOverflow(resolution)) return 'overflow';
  if (detectRecursivePropagation(resolution)) return 'recursive';
  if (resolution.fixedPoints.every((f) => f.stable)) return 'stable';
  return 'bounded';
}

export function reducePropagationComplexity(
  resolution: FixedPointResolution,
): number {
  return resolution.fixedPoints.reduce(
    (acc, f) => acc + Math.min(f.iterations, PROPAGATION_LIMIT),
    0,
  );
}
