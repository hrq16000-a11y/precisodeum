/**
 * Phase 1.9.25 — Sponsor Deterministic Topology Envelope.
 */
import {
  SponsorTopologyMutationError,
  SPONSOR_TOPOLOGY_INTERNALS,
  deepFreeze,
  signObject,
} from './sponsorTopologyInternals';
import type { SponsorSystemTopologyGraph } from './sponsorSystemTopologyGraph';
import type { SponsorExecutionDependencyGraph } from './sponsorExecutionDependencyGraph';
import type { SponsorTopologyLineage } from './sponsorTopologyLineage';
import type { SponsorTopologySnapshot } from './sponsorTopologySnapshot';
import type { SponsorTopologyRegistry } from './sponsorTopologyRegistry';

export interface SponsorDeterministicTopologyEnvelope {
  readonly envelopeVersion: 'v1';
  readonly registry: SponsorTopologyRegistry;
  readonly topology: SponsorSystemTopologyGraph;
  readonly execution: SponsorExecutionDependencyGraph;
  readonly lineage: SponsorTopologyLineage;
  readonly snapshot: SponsorTopologySnapshot;
  readonly envelopeSignature: string;
  readonly locked: true;
}

export function buildTopologyEnvelope(
  registry: SponsorTopologyRegistry,
  topology: SponsorSystemTopologyGraph,
  execution: SponsorExecutionDependencyGraph,
  lineage: SponsorTopologyLineage,
  snapshot: SponsorTopologySnapshot,
): SponsorDeterministicTopologyEnvelope {
  const envelopeSignature = signObject({
    v: 'v1',
    registry: registry.registrySignature,
    topology: topology.graphSignature,
    execution: execution.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    envelopeVersion: 'v1' as const,
    registry,
    topology,
    execution,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true as const,
  });
}

export function lockTopologyEnvelope(env: SponsorDeterministicTopologyEnvelope): void {
  if (!env.locked) throw new SponsorTopologyMutationError('envelope is not locked');
  if (!Object.isFrozen(env)) throw new SponsorTopologyMutationError('envelope not frozen');
  if (SPONSOR_TOPOLOGY_INTERNALS.upstreamMutationAllowed !== false) {
    throw new SponsorTopologyMutationError('upstream mutation flag must be false');
  }
  if (SPONSOR_TOPOLOGY_INTERNALS.postLockMutationAllowed !== false) {
    throw new SponsorTopologyMutationError('post-lock mutation flag must be false');
  }
}
