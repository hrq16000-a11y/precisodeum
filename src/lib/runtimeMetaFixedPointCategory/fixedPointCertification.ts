/**
 * Fase 1.9.11 — Certification (READ-ONLY).
 */

import { deepFreeze } from './fixedPointCategory';
import type {
  FpcCertification,
  FpcCertificationRank,
  FpcComposition,
  FpcDeterminism,
  FpcIdentity,
  FpcNormalization,
  FpcResolution,
  FpcStability,
  FpcTopology,
} from './fixedPointCategoryTypes';

export function buildCertification(
  res: FpcResolution,
  identity: FpcIdentity,
  composition: FpcComposition,
  normalization: FpcNormalization,
  determinism: FpcDeterminism,
  topology: FpcTopology,
  stability: FpcStability,
): FpcCertification {
  const reasons: string[] = [];
  if (!identity.canonical) reasons.push('identity_missing');
  if (!composition.closed) reasons.push('composition_open');
  if (!composition.associative) reasons.push('composition_nonassociative');
  if (!normalization.idempotent) reasons.push('normalization_nonidempotent');
  if (!determinism.stable) reasons.push('determinism_unstable');
  if (topology.collapsed) reasons.push('topology_collapsed');
  if (!stability.bounded) reasons.push('stability_unbounded');
  if (res.cycles.length > 0) reasons.push('cycles_present');

  const blocked =
    !determinism.stable || topology.collapsed || !composition.closed;
  const unstable = res.fixedPoints.some((f) => f.diverged);

  let rank: FpcCertificationRank;
  if (blocked) rank = 'BLOCKED';
  else if (unstable) rank = 'UNSTABLE';
  else if (reasons.length === 0) rank = 'CERTIFIED';
  else rank = 'CONDITIONALLY_CERTIFIED';

  const total = res.fixedPoints.length || 1;
  const stable = res.fixedPoints.filter((f) => f.stable).length;
  const base = stable / total;
  const penalty = Math.min(1, reasons.length * 0.1);
  const confidence = Math.max(0, Math.min(1, base - penalty));

  reasons.sort();
  return deepFreeze({
    rank,
    confidence,
    reasons: Object.freeze(reasons),
  });
}
