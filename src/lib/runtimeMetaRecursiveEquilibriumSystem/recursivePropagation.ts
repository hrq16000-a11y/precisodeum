/**
 * Fase 1.9.12 — Recursive propagation (READ-ONLY).
 */

import { deepFreeze } from './recursiveEquilibrium';
import type {
  ReqPropagation,
  ReqPropagationMode,
  ReqResolution,
} from './recursiveEquilibriumTypes';

const PROPAGATION_LIMIT = 48;

export function buildRecursivePropagation(res: ReqResolution): ReqPropagation {
  const depth = res.points.reduce((a, p) => Math.max(a, p.iterations), 0);
  const overflow = res.points.some((p) => p.iterations >= PROPAGATION_LIMIT);
  const bounded = !overflow;
  let mode: ReqPropagationMode;
  if (overflow) mode = 'overflow';
  else if (res.points.some((p) => p.diverged)) mode = 'infinite';
  else if (res.cycles.length > 0) mode = 'recursive';
  else if (depth <= 1) mode = 'stable';
  else mode = 'bounded';
  return deepFreeze({ mode, depth, overflow, bounded });
}
