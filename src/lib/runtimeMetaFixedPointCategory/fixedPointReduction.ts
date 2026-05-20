/**
 * Fase 1.9.11 — Canonical fixed-point reduction (READ-ONLY).
 */

import { deepFreeze, fpcSignature } from './fixedPointCategory';
import type {
  FpcReduction,
  FpcReductionMode,
  FpcResolution,
} from './fixedPointCategoryTypes';

const MAX_REDUCTION_STEPS = 256;

export function buildReduction(res: FpcResolution): FpcReduction {
  const steps = res.fixedPoints.reduce((a, f) => a + f.iterations, 0);
  let mode: FpcReductionMode;
  if (steps >= MAX_REDUCTION_STEPS) mode = 'infinite';
  else if (res.cycles.length > 0) mode = 'unstable';
  else if (res.fixedPoints.every((f) => f.stable)) mode = 'idempotent';
  else mode = 'normal';

  const signature = fpcSignature({
    fps: res.fixedPoints.map((f) => `${f.id}:${f.iterations}:${f.convergenceClass}`).sort(),
    cycles: res.cycles.map((c) => [...c].sort().join('>')).sort(),
    unreachable: [...res.unreachable].sort(),
  });
  return deepFreeze({ mode, steps, signature });
}
