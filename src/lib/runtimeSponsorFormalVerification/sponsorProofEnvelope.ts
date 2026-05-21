/**
 * Phase 1.9.28 — Sponsor Proof Envelope.
 * Locked, frozen, deterministic artifact wrapping the entire verification plane.
 */
import {
  SPONSOR_VERIFICATION_INTERNALS,
  SponsorVerificationMutationError,
  deepFreeze,
  signObject,
} from './sponsorVerificationInternals';
import type { SponsorInvariantRegistry } from './sponsorInvariantRegistry';
import type { SponsorConsistencyProofs } from './sponsorConsistencyProofs';
import type { SponsorVerificationMatrix } from './sponsorVerificationMatrix';
import type { SponsorProofLineage } from './sponsorProofLineage';
import type { SponsorDeterministicVerificationSnapshot } from './sponsorVerificationSnapshot';

export interface SponsorProofEnvelope {
  readonly version: 'v1';
  readonly stage: 'STAGE_0_READ_ONLY';
  readonly registry: SponsorInvariantRegistry;
  readonly proofs: SponsorConsistencyProofs;
  readonly matrix: SponsorVerificationMatrix;
  readonly lineage: SponsorProofLineage;
  readonly snapshot: SponsorDeterministicVerificationSnapshot;
  readonly envelopeSignature: string;
  readonly locked: boolean;
}

export function buildProofEnvelope(
  registry: SponsorInvariantRegistry,
  proofs: SponsorConsistencyProofs,
  matrix: SponsorVerificationMatrix,
  lineage: SponsorProofLineage,
  snapshot: SponsorDeterministicVerificationSnapshot,
): SponsorProofEnvelope {
  const envelopeSignature = signObject({
    registry: registry.registrySignature,
    proofs: proofs.proofsSignature,
    matrix: matrix.matrixSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stage: SPONSOR_VERIFICATION_INTERNALS.stage,
    registry,
    proofs,
    matrix,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true,
  });
}

export function lockProofEnvelope(env: SponsorProofEnvelope): void {
  if (!env.locked || !Object.isFrozen(env)) {
    throw new SponsorVerificationMutationError('envelope must be frozen and locked');
  }
}
