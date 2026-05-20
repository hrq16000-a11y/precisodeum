/**
 * Fase 1.9.2 — Resolution convergence (READ-ONLY, deterministic).
 */

import type { ConvergenceClass, ResolutionFixedPoint } from './convergenceTypes';

export function calculateResolutionConvergence(
  fps: readonly ResolutionFixedPoint[],
): number {
  if (fps.length === 0) return 1;
  const stable = fps.filter((f) => f.stable).length;
  return stable / fps.length;
}

export function detectOscillation(fps: readonly ResolutionFixedPoint[]): boolean {
  return fps.some((f) => f.classification === 'OSCILLATING');
}

export function detectConvergenceCollapse(
  fps: readonly ResolutionFixedPoint[],
): boolean {
  return fps.some((f) => f.classification === 'COLLAPSING');
}

export function detectEventualConvergence(
  fps: readonly ResolutionFixedPoint[],
): boolean {
  return (
    fps.length > 0 &&
    fps.every(
      (f) => f.classification === 'STABLE' || f.classification === 'EVENTUAL',
    )
  );
}

export function classifyResolutionStability(
  fps: readonly ResolutionFixedPoint[],
): ConvergenceClass {
  if (fps.length === 0) return 'STABLE';
  if (fps.some((f) => f.classification === 'DIVERGENT')) return 'DIVERGENT';
  if (detectConvergenceCollapse(fps)) return 'COLLAPSING';
  if (detectOscillation(fps)) return 'OSCILLATING';
  if (fps.every((f) => f.classification === 'STABLE')) return 'STABLE';
  return 'EVENTUAL';
}
