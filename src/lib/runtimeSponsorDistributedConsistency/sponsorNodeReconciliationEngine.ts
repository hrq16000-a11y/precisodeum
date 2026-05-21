/**
 * Phase 1.9.21 — Sponsor Distributed Consistency · Reconciliation engine.
 *
 * Reconciliation is structural ONLY. It does not change any payload, never
 * "merges" outputs, never picks winners by heuristic. It either confirms
 * deterministic equivalence (and returns the reference frame), or raises
 * a hard drift error. Tie-breaking is fixed (lexicographic nodeId).
 */
import type { SponsorEdgeConsistencyEnvelope } from '@/lib/runtimeSponsorProductSurfaceStabilization';
import type { SponsorConsistencyOrchestrationContext } from './sponsorConsistencyOrchestrationContext';
import { computeNodeEquivalenceMatrix } from './sponsorCrossNodeEquivalence';
import { assertNoDeterministicDrift } from './sponsorDeterminismDriftDetector';

export interface SponsorNodeReconciliationVector {
  readonly orchestrationId: string;
  readonly nodeCount: number;
  readonly canonicalNodeId: string;
  readonly canonicalFingerprint: string;
  readonly canonicalStabilityToken: string;
  readonly canonicalIdempotencyDigest: string;
  /** Reference envelope — kept by structural equivalence, NEVER mutated. */
  readonly canonicalEnvelope: SponsorEdgeConsistencyEnvelope;
}

export function reconcileExecutionFrames(
  ctx: SponsorConsistencyOrchestrationContext,
): SponsorNodeReconciliationVector {
  const matrix = computeNodeEquivalenceMatrix(ctx);
  assertNoDeterministicDrift(matrix);

  // Deterministic tie-break: lexicographic nodeId among all (equivalent) nodes.
  const sortedByNodeId = [...ctx.envelopes].sort((a, b) =>
    a.node.nodeId.localeCompare(b.node.nodeId),
  );
  const canonical = sortedByNodeId[0];

  return Object.freeze({
    orchestrationId: ctx.orchestrationId,
    nodeCount: ctx.envelopes.length,
    canonicalNodeId: canonical.node.nodeId,
    canonicalFingerprint: canonical.envelope.fingerprint.compositeFingerprint,
    canonicalStabilityToken: canonical.envelope.stabilityToken,
    canonicalIdempotencyDigest: canonical.envelope.idempotencyKey.digest,
    canonicalEnvelope: canonical.envelope,
  });
}
