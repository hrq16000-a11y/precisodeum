/**
 * Fase 1.9.2 — Stability envelope (READ-ONLY).
 */

import type {
  ResolutionFixedPoint,
  StabilityEnvelopeModel,
} from './convergenceTypes';

const ENVELOPE_LIMIT = 48;

export function buildStabilityEnvelope(
  fps: readonly ResolutionFixedPoint[],
): StabilityEnvelopeModel {
  const overflow = detectEnvelopeOverflow(fps);
  const recursiveInstability = detectRecursiveInstability(fps);
  const bounded = !overflow && !recursiveInstability;
  const containment = calculateEnvelopeContainment(fps);
  return Object.freeze({
    bounded,
    overflow,
    recursiveInstability,
    containment,
  });
}

export function detectEnvelopeOverflow(
  fps: readonly ResolutionFixedPoint[],
): boolean {
  return fps.some((f) => f.iterations >= ENVELOPE_LIMIT);
}

export function detectRecursiveInstability(
  fps: readonly ResolutionFixedPoint[],
): boolean {
  return fps.some(
    (f) => f.classification === 'OSCILLATING' && f.members.length > 4,
  );
}

export function calculateEnvelopeContainment(
  fps: readonly ResolutionFixedPoint[],
): number {
  if (fps.length === 0) return 1;
  const contained = fps.filter(
    (f) => f.iterations < ENVELOPE_LIMIT && f.classification !== 'DIVERGENT',
  ).length;
  return contained / fps.length;
}
