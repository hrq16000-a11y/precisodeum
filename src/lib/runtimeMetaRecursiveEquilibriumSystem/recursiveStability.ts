/**
 * Fase 1.9.12 — Recursive stability + recovery (READ-ONLY).
 */

import { deepFreeze } from './recursiveEquilibrium';
import type { ReqResolution, ReqStability } from './recursiveEquilibriumTypes';

export function buildRecursiveStability(res: ReqResolution): ReqStability {
  const total = res.points.length;
  if (total === 0) {
    return deepFreeze({
      bounded: true,
      oscillation: false,
      recoveryRate: 1,
      containment: 1,
    });
  }
  const contained = res.points.filter(
    (p) => !p.diverged && p.equilibriumClass !== 'DIVERGENT',
  ).length;
  const recovered = res.points.filter((p) => p.recovered).length;
  const oscillation = res.points.some(
    (p) => p.equilibriumClass === 'OSCILLATING',
  );
  const bounded = res.points.every((p) => !p.diverged);
  return deepFreeze({
    bounded,
    oscillation,
    recoveryRate: recovered / total,
    containment: contained / total,
  });
}
