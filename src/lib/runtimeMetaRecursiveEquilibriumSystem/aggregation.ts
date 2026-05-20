/**
 * Fase 1.9.12 — Aggregation (READ-ONLY, deterministic).
 */

import { deepFreeze, reqSignature } from './recursiveEquilibrium';
import type {
  ReqAggregate,
  ReqEnvelope,
  ReqViolation,
} from './recursiveEquilibriumTypes';

const SEV_RANK: Record<string, number> = { critical: 3, error: 2, warn: 1, info: 0 };

export function aggregateRecursiveEnvelopes(
  envelopes: readonly ReqEnvelope[],
  violations: readonly ReqViolation[],
): ReqAggregate {
  const sortedEnvs = [...envelopes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedViolations = [...violations].sort(
    (a, b) =>
      (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0) ||
      a.code.localeCompare(b.code) ||
      a.target.localeCompare(b.target),
  );
  const total = sortedEnvs.length || 1;
  const confidence =
    sortedEnvs.reduce((a, e) => a + e.certification.confidence, 0) / total;
  const score =
    (sortedEnvs.reduce((a, e) => a + e.convergence.confidence, 0) / total) * 100;
  const stable =
    sortedEnvs.length > 0 &&
    sortedEnvs.every(
      (e) =>
        e.certification.rank === 'CERTIFIED' ||
        e.certification.rank === 'CONDITIONALLY_CERTIFIED',
    ) &&
    sortedViolations.every((v) => v.severity !== 'critical');
  const signature = reqSignature({
    envs: sortedEnvs.map((e) => e.signature),
    violations: sortedViolations.map((v) => `${v.code}:${v.target}:${v.severity}`),
  });
  return deepFreeze({
    envelopes: Object.freeze(sortedEnvs),
    score,
    confidence,
    stable,
    violations: Object.freeze(sortedViolations),
    signature,
  });
}
