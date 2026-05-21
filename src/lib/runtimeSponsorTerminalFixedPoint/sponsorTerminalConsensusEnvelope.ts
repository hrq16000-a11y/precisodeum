/**
 * Phase 1.9.33 — Sponsor Terminal Consensus Envelope.
 */
import {
  SPONSOR_FIXED_POINT_INTERNALS,
  SponsorFixedPointMutationError,
  deepFreeze,
  signObject,
} from './sponsorFixedPointInternals';
import type { SponsorFixedPointConsensusRegistry } from './sponsorFixedPointConsensus';
import type { SponsorTerminalImmutabilityProofs } from './sponsorTerminalImmutabilityProofs';
import type { SponsorFixedPointGraph } from './sponsorFixedPointGraph';
import type { SponsorFixedPointLineage } from './sponsorFixedPointLineage';
import type { SponsorDeterministicFixedPointSnapshot } from './sponsorFixedPointSnapshot';

export interface SponsorTerminalConsensusEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly consensus: SponsorFixedPointConsensusRegistry;
  readonly proofs: SponsorTerminalImmutabilityProofs;
  readonly graph: SponsorFixedPointGraph;
  readonly lineage: SponsorFixedPointLineage;
  readonly snapshot: SponsorDeterministicFixedPointSnapshot;
  readonly envelopeSignature: string;
  readonly locked: true;
}

export function buildTerminalConsensusEnvelope(
  consensus: SponsorFixedPointConsensusRegistry,
  proofs: SponsorTerminalImmutabilityProofs,
  graph: SponsorFixedPointGraph,
  lineage: SponsorFixedPointLineage,
  snapshot: SponsorDeterministicFixedPointSnapshot,
): SponsorTerminalConsensusEnvelope {
  const envelopeSignature = signObject({
    s: SPONSOR_FIXED_POINT_INTERNALS.stage,
    v: SPONSOR_FIXED_POINT_INTERNALS.fixedPointPlaneVersion,
    m: SPONSOR_FIXED_POINT_INTERNALS.convergenceMode,
    snap: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: 'STAGE_0_READ_ONLY' as const,
    consensus,
    proofs,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true as const,
  });
}

export function lockFixedPointEnvelope(envelope: SponsorTerminalConsensusEnvelope): void {
  if (!envelope.locked) {
    throw new SponsorFixedPointMutationError('fixed-point envelope must be locked');
  }
  if (!Object.isFrozen(envelope)) {
    throw new SponsorFixedPointMutationError('fixed-point envelope must be frozen');
  }
}
