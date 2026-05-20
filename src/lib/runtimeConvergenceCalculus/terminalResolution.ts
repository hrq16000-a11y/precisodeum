/**
 * Fase 1.9.2 — Terminal resolution (READ-ONLY).
 */

import type {
  ResolutionFixedPoint,
  ResolutionTerminality,
  TerminalResolutionState,
} from './convergenceTypes';

export function detectInfiniteResolution(
  fps: readonly ResolutionFixedPoint[],
): boolean {
  return fps.some((f) => f.classification === 'DIVERGENT' || f.iterations >= 64);
}

export function detectPartialTerminality(
  fps: readonly ResolutionFixedPoint[],
): boolean {
  if (fps.length === 0) return false;
  const stable = fps.filter((f) => f.stable).length;
  return stable > 0 && stable < fps.length;
}

export function detectTerminalFailure(
  fps: readonly ResolutionFixedPoint[],
): boolean {
  return fps.some(
    (f) => f.classification === 'DIVERGENT' || f.classification === 'COLLAPSING',
  );
}

export function classifyTerminality(
  fps: readonly ResolutionFixedPoint[],
): ResolutionTerminality {
  if (fps.length === 0) return 'TERMINAL';
  if (detectInfiniteResolution(fps)) return 'UNRESOLVED';
  if (fps.some((f) => f.classification === 'OSCILLATING')) return 'CYCLIC';
  if (fps.every((f) => f.iterations >= 16)) return 'SATURATED';
  if (fps.every((f) => f.stable)) return 'TERMINAL';
  return 'NON_TERMINAL';
}

export function calculateTerminalResolution(
  fps: readonly ResolutionFixedPoint[],
): TerminalResolutionState {
  return Object.freeze({
    terminality: classifyTerminality(fps),
    infinite: detectInfiniteResolution(fps),
    partial: detectPartialTerminality(fps),
    failed: detectTerminalFailure(fps),
  });
}
