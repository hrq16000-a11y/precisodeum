/**
 * Fase 1.9.2 — Saturation analysis (READ-ONLY).
 */

import type {
  ResolutionFixedPoint,
  SaturationEnvelope,
  SaturationLevel,
} from './convergenceTypes';

export function calculateSaturation(
  fps: readonly ResolutionFixedPoint[],
): number {
  if (fps.length === 0) return 0;
  const saturated = fps.filter(
    (f) =>
      f.iterations >= 32 ||
      f.classification === 'COLLAPSING' ||
      f.classification === 'OSCILLATING',
  ).length;
  return saturated / fps.length;
}

export function detectSaturationCollapse(
  fps: readonly ResolutionFixedPoint[],
): boolean {
  return fps.some((f) => f.classification === 'COLLAPSING');
}

export function detectPropagationSaturation(
  fps: readonly ResolutionFixedPoint[],
): boolean {
  return fps.some((f) => f.iterations >= 48);
}

export function detectTerminalSaturation(
  fps: readonly ResolutionFixedPoint[],
): boolean {
  return (
    fps.length > 0 &&
    fps.every((f) => f.iterations >= 16 || f.classification === 'COLLAPSING')
  );
}

export function classifySaturationLevel(score: number): SaturationLevel {
  if (score === 0) return 'NONE';
  if (score < 0.25) return 'LOW';
  if (score < 0.5) return 'MEDIUM';
  if (score < 0.8) return 'HIGH';
  return 'CRITICAL';
}

export function buildSaturationEnvelope(
  fps: readonly ResolutionFixedPoint[],
): SaturationEnvelope {
  const score = calculateSaturation(fps);
  const level = classifySaturationLevel(score);
  return Object.freeze({
    level,
    score,
    collapsed: detectSaturationCollapse(fps),
    propagationSaturated: detectPropagationSaturation(fps),
    terminalSaturated: detectTerminalSaturation(fps),
  });
}
