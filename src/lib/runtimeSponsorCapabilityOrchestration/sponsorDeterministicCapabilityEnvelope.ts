/**
 * Phase 1.9.24 — Deterministic Capability Envelope.
 * Final locked artifact for the capability plane.
 */
import {
  SponsorCapabilityMutationError,
  SPONSOR_CAPABILITY_INTERNALS,
  deepFreeze,
  signObject,
} from './sponsorCapabilityInternals';
import type { SponsorCapabilityRegistry } from './sponsorCapabilityRegistry';
import type { SponsorEntitlementMatrix } from './sponsorEntitlementMatrix';
import type { SponsorCapabilityCompatibilityGraph } from './sponsorCapabilityCompatibility';
import type { SponsorCapabilityLineage } from './sponsorCapabilityLineage';
import type { SponsorCapabilitySnapshot } from './sponsorCapabilitySnapshot';

export interface SponsorDeterministicCapabilityEnvelope {
  readonly envelopeVersion: 'v1';
  readonly registry: SponsorCapabilityRegistry;
  readonly matrix: SponsorEntitlementMatrix;
  readonly graph: SponsorCapabilityCompatibilityGraph;
  readonly lineage: SponsorCapabilityLineage;
  readonly snapshot: SponsorCapabilitySnapshot;
  readonly envelopeSignature: string;
  readonly locked: true;
}

export function buildCapabilityEnvelope(
  registry: SponsorCapabilityRegistry,
  matrix: SponsorEntitlementMatrix,
  graph: SponsorCapabilityCompatibilityGraph,
  lineage: SponsorCapabilityLineage,
  snapshot: SponsorCapabilitySnapshot,
): SponsorDeterministicCapabilityEnvelope {
  const envelopeSignature = signObject({
    v: 'v1',
    registry: registry.registrySignature,
    matrix: matrix.matrixSignature,
    graph: graph.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    envelopeVersion: 'v1' as const,
    registry,
    matrix,
    graph,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true as const,
  });
}

export function lockCapabilityEnvelope(envelope: SponsorDeterministicCapabilityEnvelope): void {
  if (!envelope.locked) {
    throw new SponsorCapabilityMutationError('envelope is not locked');
  }
  if (!Object.isFrozen(envelope) || !Object.isFrozen(envelope.registry)) {
    throw new SponsorCapabilityMutationError('envelope or registry not frozen');
  }
  if (SPONSOR_CAPABILITY_INTERNALS.upstreamMutationAllowed !== false) {
    throw new SponsorCapabilityMutationError('upstream mutation flag must be false');
  }
  if (SPONSOR_CAPABILITY_INTERNALS.postLockMutationAllowed !== false) {
    throw new SponsorCapabilityMutationError('post-lock mutation flag must be false');
  }
  if (SPONSOR_CAPABILITY_INTERNALS.functionalActivationAllowed !== false) {
    throw new SponsorCapabilityMutationError('functional activation must be false');
  }
}
