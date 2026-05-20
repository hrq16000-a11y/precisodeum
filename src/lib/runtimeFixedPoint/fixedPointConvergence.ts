/**
 * Fase 1.9.1 — Convergence model (READ-ONLY).
 */

import type {
  FixedPointConvergence,
  FixedPointConvergenceMode,
  FixedPointResolution,
} from './fixedPointTypes';

export function buildConvergenceModel(
  resolution: FixedPointResolution,
): FixedPointConvergence {
  const mode = classifyConvergence(resolution);
  const confidence = calculateConvergenceConfidence(resolution);
  return Object.freeze({
    mode,
    confidence,
    regressed: detectConvergenceRegression(resolution),
    asymptoticallyStable: !detectAsymptoticInstability(resolution),
  });
}

export function classifyConvergence(
  resolution: FixedPointResolution,
): FixedPointConvergenceMode {
  if (resolution.fixedPoints.length === 0) return 'unstable';
  if (resolution.impossible.length > 0) return 'divergent';
  if (resolution.unstable.length > 0) return 'unstable';
  if (resolution.loops.length > 0) return 'eventual';
  const allStable = resolution.fixedPoints.every((f) => f.class === 'stable');
  if (allStable) return 'strict';
  return 'deterministic';
}

export function detectConvergenceRegression(
  resolution: FixedPointResolution,
): boolean {
  return resolution.unstable.length > 0 || resolution.impossible.length > 0;
}

export function detectAsymptoticInstability(
  resolution: FixedPointResolution,
): boolean {
  return resolution.fixedPoints.some(
    (f) => f.class === 'divergent' || f.class === 'unstable',
  );
}

export function detectNonConvergentPropagation(
  resolution: FixedPointResolution,
): boolean {
  return resolution.loops.length > 0 && resolution.unstable.length > 0;
}

export function calculateConvergenceConfidence(
  resolution: FixedPointResolution,
): number {
  const total = resolution.fixedPoints.length;
  if (total === 0) return 0;
  const stable = resolution.fixedPoints.filter((f) => f.stable).length;
  const penalty =
    resolution.impossible.length * 0.25 +
    resolution.unstable.length * 0.15 +
    resolution.loops.length * 0.05;
  const base = stable / total;
  return Math.max(0, Math.min(1, base - penalty));
}
