/**
 * Fase 1.9.11 — Stability envelope (READ-ONLY).
 */

import { deepFreeze } from './fixedPointCategory';
import type { FpcResolution, FpcStability } from './fixedPointCategoryTypes';

export function buildStability(res: FpcResolution): FpcStability {
  const total = res.fixedPoints.length;
  if (total === 0) {
    return deepFreeze({ bounded: true, oscillation: false, containment: 1 });
  }
  const contained = res.fixedPoints.filter(
    (f) => !f.diverged && f.convergenceClass !== 'DIVERGENT',
  ).length;
  const oscillation = res.fixedPoints.some(
    (f) => f.convergenceClass === 'OSCILLATING',
  );
  const bounded = res.fixedPoints.every((f) => !f.diverged);
  return deepFreeze({
    bounded,
    oscillation,
    containment: contained / total,
  });
}
