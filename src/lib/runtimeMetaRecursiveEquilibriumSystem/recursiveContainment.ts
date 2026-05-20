/**
 * Fase 1.9.12 — Recursive containment (READ-ONLY).
 */

import { deepFreeze } from './recursiveEquilibrium';
import type {
  ReqContainment,
  ReqContainmentClass,
  ReqResolution,
} from './recursiveEquilibriumTypes';

export function buildRecursiveContainment(res: ReqResolution): ReqContainment {
  const depth = res.points.reduce((a, p) => Math.max(a, p.iterations), 0);
  const leaking = res.unreachable.length > 0;
  const collapsing =
    res.points.length > 0 && res.points.every((p) => p.diverged);

  let classification: ReqContainmentClass;
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
