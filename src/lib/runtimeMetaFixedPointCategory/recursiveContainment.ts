/**
 * Fase 1.9.11 — Recursive containment (READ-ONLY).
 */

import { deepFreeze } from './fixedPointCategory';
import type {
  FpcContainment,
  FpcContainmentClass,
  FpcResolution,
} from './fixedPointCategoryTypes';

export function buildContainment(res: FpcResolution): FpcContainment {
  const depth = res.fixedPoints.reduce((a, f) => Math.max(a, f.iterations), 0);
  const leaking = res.unreachable.length > 0;
  const collapsing =
    res.fixedPoints.length > 0 && res.fixedPoints.every((f) => f.diverged);

  let classification: FpcContainmentClass;
  if (collapsing) classification = 'collapsing';
  else if (leaking) classification = 'leaking';
  else if (res.cycles.length > 0) classification = 'recursive';
  else if (depth <= 1) classification = 'isolated';
  else classification = 'bounded';

  return deepFreeze({
    classification,
    leaking,
    collapsing,
    depth,
  });
}
