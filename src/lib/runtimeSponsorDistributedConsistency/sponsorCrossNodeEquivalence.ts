/**
 * Phase 1.9.21 — Sponsor Distributed Consistency · Cross-node equivalence.
 * Pure structural comparison over edge envelopes. No mutation.
 */
import type { SponsorEdgeConsistencyEnvelope } from '@/lib/runtimeSponsorProductSurfaceStabilization';
import { fingerprintsMatch } from '@/lib/runtimeSponsorProductSurfaceStabilization';
import type { SponsorConsistencyOrchestrationContext } from './sponsorConsistencyOrchestrationContext';

export interface SponsorDistributedParityFrame {
  readonly nodeId: string;
  readonly compositeFingerprint: string;
  readonly stabilityToken: string;
  readonly idempotencyDigest: string;
  readonly etag: string;
  readonly cacheKey: string;
}

export interface SponsorCrossNodeEquivalenceResult {
  readonly frames: ReadonlyArray<SponsorDistributedParityFrame>;
  readonly referenceFingerprint: string;
  readonly referenceStabilityToken: string;
  readonly referenceIdempotencyDigest: string;
  readonly equivalent: boolean;
  readonly divergences: ReadonlyArray<{
    readonly nodeId: string;
    readonly reason: string;
  }>;
}

function frameOf(
  nodeId: string,
  env: SponsorEdgeConsistencyEnvelope,
): SponsorDistributedParityFrame {
  return Object.freeze({
    nodeId,
    compositeFingerprint: env.fingerprint.compositeFingerprint,
    stabilityToken: env.stabilityToken,
    idempotencyDigest: env.idempotencyKey.digest,
    etag: env.fingerprint.etag,
    cacheKey: env.fingerprint.cacheKey,
  });
}

export function computeNodeEquivalenceMatrix(
  ctx: SponsorConsistencyOrchestrationContext,
): SponsorCrossNodeEquivalenceResult {
  if (ctx.envelopes.length === 0) {
    throw new Error('[sponsor-consistency] orchestration context has no envelopes');
  }
  const frames = ctx.envelopes.map((p) => frameOf(p.node.nodeId, p.envelope));
  const ref = frames[0];
  const divergences: Array<{ nodeId: string; reason: string }> = [];

  for (let i = 1; i < ctx.envelopes.length; i++) {
    const f = frames[i];
    const envRef = ctx.envelopes[0].envelope;
    const envCur = ctx.envelopes[i].envelope;
    if (f.compositeFingerprint !== ref.compositeFingerprint) {
      divergences.push({ nodeId: f.nodeId, reason: 'compositeFingerprint mismatch' });
    } else if (!fingerprintsMatch(envRef.fingerprint, envCur.fingerprint)) {
      divergences.push({ nodeId: f.nodeId, reason: 'fingerprint structural mismatch' });
    }
    if (f.stabilityToken !== ref.stabilityToken) {
      divergences.push({ nodeId: f.nodeId, reason: 'stabilityToken drift' });
    }
    if (f.idempotencyDigest !== ref.idempotencyDigest) {
      divergences.push({ nodeId: f.nodeId, reason: 'idempotency digest drift' });
    }
    if (f.etag !== ref.etag) {
      divergences.push({ nodeId: f.nodeId, reason: 'etag drift' });
    }
    if (f.cacheKey !== ref.cacheKey) {
      divergences.push({ nodeId: f.nodeId, reason: 'cacheKey drift' });
    }
  }

  return Object.freeze({
    frames: Object.freeze(frames),
    referenceFingerprint: ref.compositeFingerprint,
    referenceStabilityToken: ref.stabilityToken,
    referenceIdempotencyDigest: ref.idempotencyDigest,
    equivalent: divergences.length === 0,
    divergences: Object.freeze(divergences.map((d) => Object.freeze(d))),
  });
}
