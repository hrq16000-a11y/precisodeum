/**
 * Fase 1.9.12 — Recursive convergence + recovery (READ-ONLY).
 */

import { deepFreeze } from './recursiveEquilibrium';
import type {
  ReqConvergenceClass,
  ReqConvergenceModel,
  ReqResolution,
} from './recursiveEquilibriumTypes';

export function classifyRecursiveConvergence(
  res: ReqResolution,
): ReqConvergenceClass {
  if (res.points.length === 0) return 'SEALED';
  if (res.points.some((p) => p.diverged)) return 'DIVERGENT';
  if (res.cycles.length > 0) return 'OSCILLATING';
  if (res.points.every((p) => p.equilibriumClass === 'STABLE')) return 'STABLE';
  if (res.points.every((p) => !p.cycle && !p.diverged)) return 'EVENTUAL';
  return 'OSCILLATING';
}

export function buildRecursiveConvergenceModel(
  res: ReqResolution,
): ReqConvergenceModel {
  const classification = classifyRecursiveConvergence(res);
  const total = res.points.length || 1;
  const stable = res.points.filter(
    (p) => p.equilibriumClass === 'STABLE',
  ).length;
  const penalty =
    res.cycles.length * 0.1 +
    res.unreachable.length * 0.05 +
    res.points.filter((p) => p.diverged).length * 0.2;
  const confidence = Math.max(0, Math.min(1, stable / total - penalty));
  const regressed =
    res.points.some((p) => p.diverged) || res.cycles.length > 0;
  const recovered = res.points.some((p) => p.recovered);
  return deepFreeze({ classification, confidence, regressed, recovered });
}
