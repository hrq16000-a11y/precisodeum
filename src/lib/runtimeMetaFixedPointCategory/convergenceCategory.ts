/**
 * Fase 1.9.11 — Convergence category model (READ-ONLY).
 */

import { deepFreeze } from './fixedPointCategory';
import type {
  FpcConvergenceClass,
  FpcConvergenceModel,
  FpcResolution,
} from './fixedPointCategoryTypes';

export function classifyConvergence(res: FpcResolution): FpcConvergenceClass {
  if (res.fixedPoints.length === 0) return 'SEALED';
  if (res.fixedPoints.some((f) => f.diverged)) return 'DIVERGENT';
  if (res.cycles.length > 0) return 'OSCILLATING';
  if (res.fixedPoints.every((f) => f.stable && f.iterations <= 2)) return 'STABLE';
  if (res.fixedPoints.every((f) => f.stable)) return 'EVENTUAL';
  return 'OSCILLATING';
}

export function buildConvergenceModel(res: FpcResolution): FpcConvergenceModel {
  const classification = classifyConvergence(res);
  const total = res.fixedPoints.length || 1;
  const stable = res.fixedPoints.filter((f) => f.stable).length;
  const penalty =
    res.cycles.length * 0.1 +
    res.unreachable.length * 0.05 +
    res.fixedPoints.filter((f) => f.diverged).length * 0.2;
  const confidence = Math.max(0, Math.min(1, stable / total - penalty));
  const regressed = res.fixedPoints.some((f) => f.diverged) || res.cycles.length > 0;
  return deepFreeze({ classification, confidence, regressed });
}
