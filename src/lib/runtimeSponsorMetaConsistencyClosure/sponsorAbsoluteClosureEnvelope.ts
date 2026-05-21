/**
 * Phase 1.9.32 — Sponsor Absolute Closure Envelope.
 * Locked terminal closure artifact.
 */
import {
  SPONSOR_CLOSURE_INTERNALS,
  SponsorClosureMutationError,
  deepFreeze,
  signObject,
} from './sponsorClosureInternals';
import type { SponsorConsistencyTheoremRegistry } from './sponsorConsistencyTheorems';
import type { SponsorTerminalConsistencyProofs } from './sponsorTerminalConsistencyProofs';
import type { SponsorClosureTheoremGraph } from './sponsorClosureTheoremGraph';
import type { SponsorClosureLineage } from './sponsorClosureLineage';
import type { SponsorDeterministicClosureSnapshot } from './sponsorClosureSnapshot';

export interface SponsorAbsoluteClosureEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly theorems: SponsorConsistencyTheoremRegistry;
  readonly proofs: SponsorTerminalConsistencyProofs;
  readonly graph: SponsorClosureTheoremGraph;
  readonly lineage: SponsorClosureLineage;
  readonly snapshot: SponsorDeterministicClosureSnapshot;
  readonly envelopeSignature: string;
  readonly locked: true;
}

export function buildAbsoluteClosureEnvelope(
  theorems: SponsorConsistencyTheoremRegistry,
  proofs: SponsorTerminalConsistencyProofs,
  graph: SponsorClosureTheoremGraph,
  lineage: SponsorClosureLineage,
  snapshot: SponsorDeterministicClosureSnapshot,
): SponsorAbsoluteClosureEnvelope {
  const envelopeSignature = signObject({
    s: SPONSOR_CLOSURE_INTERNALS.stage,
    v: SPONSOR_CLOSURE_INTERNALS.closurePlaneVersion,
    snap: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: 'STAGE_0_READ_ONLY' as const,
    theorems,
    proofs,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true as const,
  });
}

export function lockClosureEnvelope(envelope: SponsorAbsoluteClosureEnvelope): void {
  if (!envelope.locked) {
    throw new SponsorClosureMutationError('closure envelope must be locked');
  }
  if (!Object.isFrozen(envelope)) {
    throw new SponsorClosureMutationError('closure envelope must be frozen');
  }
}
