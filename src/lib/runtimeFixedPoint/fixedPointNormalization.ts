/**
 * Fase 1.9.1 — Normalization (READ-ONLY, deterministic).
 */

import type {
  FixedPointNormalization,
  FixedPointNormalizationMode,
  FixedPointResolution,
  RuntimeFixedPoint,
} from './fixedPointTypes';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

export function normalizeFixedPointState(
  fp: RuntimeFixedPoint,
): string {
  return stableStringify({
    id: fp.id,
    class: fp.class,
    iterations: fp.iterations,
    stable: fp.stable,
    states: fp.states.map((s) => s.signature),
  });
}

export function normalizeRecursiveResolution(
  resolution: FixedPointResolution,
): string {
  return stableStringify({
    fps: resolution.fixedPoints.map(normalizeFixedPointState).sort(),
    loops: [...resolution.loops].sort(),
    unstable: [...resolution.unstable].sort(),
    impossible: [...resolution.impossible].sort(),
  });
}

export function normalizePropagationChain(
  resolution: FixedPointResolution,
): string {
  return stableStringify(
    resolution.fixedPoints.map((f) => ({ id: f.id, it: f.iterations })).sort((a, b) => a.id.localeCompare(b.id)),
  );
}

export function detectNormalizationOscillation(
  resolution: FixedPointResolution,
): boolean {
  const a = normalizeRecursiveResolution(resolution);
  const b = normalizeRecursiveResolution(resolution);
  return a !== b;
}

export function detectNormalizationInstability(
  resolution: FixedPointResolution,
): boolean {
  return detectNormalizationOscillation(resolution);
}

export function classifyNormalizationStability(
  resolution: FixedPointResolution,
): FixedPointNormalization {
  const signature = normalizeRecursiveResolution(resolution);
  const oscillating = detectNormalizationOscillation(resolution);
  const idempotent = !oscillating;
  let mode: FixedPointNormalizationMode;
  if (oscillating) mode = 'oscillating';
  else if (resolution.unstable.length > 0) mode = 'unstable';
  else if (idempotent) mode = 'idempotent';
  else mode = 'stable';
  return Object.freeze({ mode, idempotent, oscillating, signature });
}
