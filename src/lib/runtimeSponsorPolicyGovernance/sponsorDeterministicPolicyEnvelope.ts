/**
 * Phase 1.9.23 — Deterministic Policy Envelope.
 * The final locked artifact for the governance control plane.
 */
import {
  SponsorPolicyMutationError,
  SPONSOR_POLICY_INTERNALS,
  deepFreeze,
  signObject,
} from './sponsorPolicyInternals';
import type { SponsorPolicyRegistry } from './sponsorPolicyRegistry';
import type { SponsorPolicyCompatibilityMatrix } from './sponsorPolicyCompatibility';
import type { SponsorRuleLineage } from './sponsorRuleLineage';
import type { SponsorGovernanceSnapshot } from './sponsorGovernanceSnapshot';

export interface SponsorDeterministicPolicyEnvelope {
  readonly envelopeVersion: 'v1';
  readonly registry: SponsorPolicyRegistry;
  readonly matrix: SponsorPolicyCompatibilityMatrix;
  readonly lineage: SponsorRuleLineage;
  readonly snapshot: SponsorGovernanceSnapshot;
  readonly envelopeSignature: string;
  readonly locked: true;
}

export function buildPolicyEnvelope(
  registry: SponsorPolicyRegistry,
  matrix: SponsorPolicyCompatibilityMatrix,
  lineage: SponsorRuleLineage,
  snapshot: SponsorGovernanceSnapshot,
): SponsorDeterministicPolicyEnvelope {
  const envelopeSignature = signObject({
    v: 'v1',
    registry: registry.registrySignature,
    matrix: matrix.matrixSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    envelopeVersion: 'v1' as const,
    registry,
    matrix,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true as const,
  });
}

export function lockPolicyEnvelope(envelope: SponsorDeterministicPolicyEnvelope): void {
  if (!envelope.locked) {
    throw new SponsorPolicyMutationError('envelope is not locked');
  }
  if (!Object.isFrozen(envelope) || !Object.isFrozen(envelope.registry)) {
    throw new SponsorPolicyMutationError('envelope or registry not frozen');
  }
  if (SPONSOR_POLICY_INTERNALS.upstreamMutationAllowed !== false) {
    throw new SponsorPolicyMutationError('upstream mutation flag must be false');
  }
  if (SPONSOR_POLICY_INTERNALS.postLockMutationAllowed !== false) {
    throw new SponsorPolicyMutationError('post-lock mutation flag must be false');
  }
}
