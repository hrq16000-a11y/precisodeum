/**
 * Fase 1.9.2 — Monotonic resolution (READ-ONLY).
 */

import type {
  ConvergenceNode,
  ConvergenceSpace,
  MonotonicResolution,
  MonotonicityClass,
  ResolutionFixedPoint,
} from './convergenceTypes';

function gatherValues(
  space: ConvergenceSpace,
  fp: ResolutionFixedPoint,
): readonly number[] {
  const map = new Map<string, ConvergenceNode>();
  for (const n of space.nodes) map.set(n.id, n);
  const out: number[] = [];
  for (const id of fp.members) {
    const n = map.get(id);
    if (n) out.push(n.value);
  }
  return Object.freeze(out);
}

export function isMonotonicResolution(values: readonly number[]): boolean {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] < values[i - 1]) return false;
  }
  return true;
}

export function detectResolutionRegression(values: readonly number[]): boolean {
  let regressions = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] < values[i - 1]) regressions += 1;
  }
  return regressions > 0;
}

export function detectReversePropagation(values: readonly number[]): boolean {
  if (values.length < 2) return false;
  return values[values.length - 1] < values[0];
}

export function calculateMonotonicityScore(values: readonly number[]): number {
  if (values.length <= 1) return 1;
  let monotonic = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] >= values[i - 1]) monotonic += 1;
  }
  return monotonic / (values.length - 1);
}

export function classifyMonotonicity(values: readonly number[]): MonotonicityClass {
  if (values.length <= 1) return 'STRICT';
  const reverse = detectReversePropagation(values);
  if (reverse) return 'REVERSING';
  const score = calculateMonotonicityScore(values);
  if (score === 1) return 'STRICT';
  if (score >= 0.75) return 'WEAK';
  return 'BROKEN';
}

export function buildMonotonicResolution(
  space: ConvergenceSpace,
  fps: readonly ResolutionFixedPoint[],
): MonotonicResolution {
  const all: number[] = [];
  for (const fp of fps) all.push(...gatherValues(space, fp));
  const classification = classifyMonotonicity(all);
  const score = calculateMonotonicityScore(all);
  const regressed = detectResolutionRegression(all);
  const reversed = detectReversePropagation(all);
  return Object.freeze({ classification, score, regressed, reversed });
}
