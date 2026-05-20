/**
 * Fase 1.9.12 — Recursive reduction (READ-ONLY).
 */

import { deepFreeze, reqSignature } from './recursiveEquilibrium';
import type {
  ReqReduction,
  ReqReductionMode,
  ReqResolution,
} from './recursiveEquilibriumTypes';

const MAX_REDUCTION_STEPS = 256;

export function buildRecursiveReduction(res: ReqResolution): ReqReduction {
  const steps = res.points.reduce((a, p) => a + p.iterations, 0);
  let mode: ReqReductionMode;
  if (steps >= MAX_REDUCTION_STEPS) mode = 'infinite';
  else if (res.cycles.length > 0) mode = 'unstable';
  else if (res.points.every((p) => p.equilibriumClass === 'STABLE')) mode = 'idempotent';
  else mode = 'normal';
  const signature = reqSignature({
    pts: res.points.map((p) => `${p.id}:${p.iterations}:${p.equilibriumClass}`).sort(),
    cycles: res.cycles.map((c) => [...c].sort().join('>')).sort(),
    unreachable: [...res.unreachable].sort(),
  });
  return deepFreeze({ mode, steps, signature });
}
