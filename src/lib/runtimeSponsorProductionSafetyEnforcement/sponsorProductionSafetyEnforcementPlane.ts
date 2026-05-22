/**
 * Phase 1.9.48 — SponsorProductionSafetyEnforcementPlane orchestrator.
 */
import { deepFreeze, assertEnvelopeDeterminism } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { runSafetyEnforcementRuntime } from './sponsorSafetyEnforcementRuntime';
import { buildSafetyProofs } from './sponsorSafetyProofs';
import { buildSafetyLineage } from './sponsorSafetyLineage';
import { buildSafetySnapshot } from './sponsorSafetySnapshot';
import { buildSafetyEnvelope, type SafetyEnvelopePayload } from './sponsorSafetyEnvelope';
import type { DeterministicEnvelope } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import type { SafetyConstraintInput } from './sponsorSafetyConstraintEngine';

export interface SponsorProductionSafetyEnforcementPlane {
  readonly version: 'v1';
  readonly envelope: DeterministicEnvelope<SafetyEnvelopePayload>;
  readonly planeSignature: string;
  readonly activationAllowed: false;
}

export function resolveSponsorProductionSafetyEnforcementPlane(
  input: SafetyConstraintInput = {},
): SponsorProductionSafetyEnforcementPlane {
  const runtime = runSafetyEnforcementRuntime(input);
  const proofs = buildSafetyProofs();
  const lineage = buildSafetyLineage(runtime, proofs);
  const snapshot = buildSafetySnapshot(runtime, lineage, proofs);
  const envelope = buildSafetyEnvelope(snapshot);
  return deepFreeze({
    version: 'v1' as const,
    envelope,
    planeSignature: envelope.envelopeSignature,
    activationAllowed: false as const,
  });
}

export function assertSafetyEnforcementDeterminism(
  plane: SponsorProductionSafetyEnforcementPlane,
): boolean {
  return assertEnvelopeDeterminism(plane.envelope)
    && plane.activationAllowed === false
    && Object.isFrozen(plane);
}
