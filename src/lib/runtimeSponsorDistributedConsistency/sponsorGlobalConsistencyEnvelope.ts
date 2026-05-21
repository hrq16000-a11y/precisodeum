/**
 * Phase 1.9.21 — Sponsor Distributed Consistency · Global envelope.
 * Auditable, immutable, deterministic global parity envelope.
 */
import type { SponsorCrossNodeEquivalenceResult } from './sponsorCrossNodeEquivalence';
import type { SponsorNodeReconciliationVector } from './sponsorNodeReconciliationEngine';
import type { SponsorConsistencyOrchestrationContext } from './sponsorConsistencyOrchestrationContext';
import { deepFreeze, fnv1a, stableStringify } from './sponsorConsistencyInternals';

export interface SponsorGlobalDeterminismEnvelope {
  readonly envelopeVersion: 'v1';
  readonly orchestrationId: string;
  readonly nodeCount: number;
  readonly nodeIds: ReadonlyArray<string>;
  readonly equivalence: SponsorCrossNodeEquivalenceResult;
  readonly reconciliation: SponsorNodeReconciliationVector;
  readonly globalFingerprint: string;
  readonly globalConsistencyToken: string;
  readonly locked: true;
}

export function buildGlobalConsistencyEnvelope(
  ctx: SponsorConsistencyOrchestrationContext,
  equivalence: SponsorCrossNodeEquivalenceResult,
  reconciliation: SponsorNodeReconciliationVector,
): SponsorGlobalDeterminismEnvelope {
  const nodeIds = ctx.envelopes.map((p) => p.node.nodeId).sort();
  const globalFingerprint = fnv1a(
    stableStringify({
      ref: equivalence.referenceFingerprint,
      stab: equivalence.referenceStabilityToken,
      idem: equivalence.referenceIdempotencyDigest,
      nodes: nodeIds,
    }),
  );
  const globalConsistencyToken = `gct:v1:${fnv1a(
    stableStringify({
      orchestrationId: ctx.orchestrationId,
      globalFingerprint,
      canonicalNodeId: reconciliation.canonicalNodeId,
    }),
  )}`;
  return deepFreeze({
    envelopeVersion: 'v1' as const,
    orchestrationId: ctx.orchestrationId,
    nodeCount: ctx.envelopes.length,
    nodeIds: Object.freeze(nodeIds),
    equivalence,
    reconciliation,
    globalFingerprint,
    globalConsistencyToken,
    locked: true as const,
  });
}
