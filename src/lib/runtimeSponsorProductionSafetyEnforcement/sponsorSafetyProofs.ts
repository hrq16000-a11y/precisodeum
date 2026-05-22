/**
 * Phase 1.9.48 — Safety proofs (subject × invariant matrix).
 */
import { buildProofMatrix, type CanonicalProofMatrix } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { SAFETY_UPSTREAM_LAYERS } from './sponsorSafetyInternals';
import { SPONSOR_SAFETY_INVARIANTS } from './sponsorInvariantViolationRegistry';

export function buildSafetyProofs(): CanonicalProofMatrix {
  const subjects = SAFETY_UPSTREAM_LAYERS.map((l) => `layer:${l}`);
  const invariants = SPONSOR_SAFETY_INVARIANTS.map((i) => i.id);
  return buildProofMatrix(subjects, invariants);
}
