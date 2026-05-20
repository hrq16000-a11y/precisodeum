/**
 * Fase 1.9.12 — Recursive certification (READ-ONLY).
 */

import { deepFreeze } from './recursiveEquilibrium';
import type {
  ReqCertification,
  ReqCertificationRank,
  ReqComposition,
  ReqDeterminism,
  ReqIdentity,
  ReqNormalization,
  ReqResolution,
  ReqStability,
  ReqTopology,
} from './recursiveEquilibriumTypes';

export function buildRecursiveCertification(
  res: ReqResolution,
  identity: ReqIdentity,
  composition: ReqComposition,
  normalization: ReqNormalization,
  determinism: ReqDeterminism,
  topology: ReqTopology,
  stability: ReqStability,
): ReqCertification {
  const reasons: string[] = [];
  if (!identity.canonical) reasons.push('identity_missing');
  if (!identity.idempotent) reasons.push('identity_nonidempotent');
  if (!composition.closed) reasons.push('composition_open');
  if (!composition.associative) reasons.push('composition_nonassociative');
  if (!normalization.idempotent) reasons.push('normalization_nonidempotent');
  if (!determinism.stable) reasons.push('determinism_unstable');
  if (topology.collapsed) reasons.push('topology_collapsed');
  if (!stability.bounded) reasons.push('stability_unbounded');
  if (res.cycles.length > 0) reasons.push('cycles_present');

  const blocked =
    !determinism.stable || topology.collapsed || !composition.closed;
  const unstable = res.points.some((p) => p.diverged);

  let rank: ReqCertificationRank;
  if (blocked) rank = 'BLOCKED';
  else if (unstable) rank = 'UNSTABLE';
  else if (reasons.length === 0) rank = 'CERTIFIED';
  else rank = 'CONDITIONALLY_CERTIFIED';

  const total = res.points.length || 1;
  const stable = res.points.filter(
    (p) => p.equilibriumClass === 'STABLE' || p.equilibriumClass === 'RECOVERING',
  ).length;
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
