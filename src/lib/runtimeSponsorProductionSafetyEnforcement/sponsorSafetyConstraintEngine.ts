/**
 * Phase 1.9.48 — Safety constraint engine.
 */
import { signObject } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import {
  SPONSOR_SAFETY_INVARIANTS,
  recordViolation,
  type SponsorSafetyViolation,
} from './sponsorInvariantViolationRegistry';
import { SPONSOR_SAFETY_INTERNALS } from './sponsorSafetyInternals';

export interface SafetyConstraintInput {
  readonly realNetworking?: boolean;
  readonly realPersistence?: boolean;
  readonly realBilling?: boolean;
  readonly realScheduling?: boolean;
  readonly realMonetization?: boolean;
  readonly upstreamMutated?: boolean;
  readonly nonDeterministic?: boolean;
  readonly exposureExceeded?: boolean;
  readonly rolloutInvalid?: boolean;
  readonly activationInvalid?: boolean;
}

export interface SafetyConstraintEvaluation {
  readonly violations: ReadonlyArray<SponsorSafetyViolation>;
  readonly evaluationSignature: string;
}

export function evaluateSafetyConstraints(input: SafetyConstraintInput): SafetyConstraintEvaluation {
  const v: SponsorSafetyViolation[] = [];
  if (input.realNetworking) v.push(recordViolation('SAFE-NO-REAL-NETWORKING', 'real networking attempted'));
  if (input.realPersistence) v.push(recordViolation('SAFE-NO-REAL-PERSISTENCE', 'real persistence attempted'));
  if (input.realBilling) v.push(recordViolation('SAFE-NO-REAL-BILLING', 'real billing attempted'));
  if (input.realScheduling) v.push(recordViolation('SAFE-NO-REAL-SCHEDULING', 'real scheduling attempted'));
  if (input.realMonetization) v.push(recordViolation('SAFE-NO-REAL-MONETIZATION', 'real monetization attempted'));
  if (input.upstreamMutated) v.push(recordViolation('SAFE-NO-UPSTREAM-MUTATION', 'upstream mutation detected'));
  if (input.nonDeterministic) v.push(recordViolation('SAFE-DETERMINISTIC-EXECUTION', 'non-deterministic execution'));
  if (input.exposureExceeded) v.push(recordViolation('SAFE-EXPOSURE-CAPPED', 'exposure cap exceeded'));
  if (input.rolloutInvalid) v.push(recordViolation('SAFE-ROLLOUT-FAIL-CLOSED', 'rollout invariants violated'));
  if (input.activationInvalid) v.push(recordViolation('SAFE-ACTIVATION-FAIL-CLOSED', 'activation invariants violated'));
  // Sort canonically for determinism.
  const sorted = [...v].sort((a, b) => (a.invariantId < b.invariantId ? -1 : a.invariantId > b.invariantId ? 1 : 0));
  return Object.freeze({
    violations: Object.freeze(sorted),
    evaluationSignature: signObject(sorted.map((s) => s.violationSignature)),
  });
}

export function getSafetyInvariantIds(): ReadonlyArray<string> {
  return Object.freeze(SPONSOR_SAFETY_INVARIANTS.map((i) => i.id));
}

// Sanity export to confirm the constraint engine respects internal defaults.
export const SAFETY_DEFAULT_DECISION = SPONSOR_SAFETY_INTERNALS.defaultDecision;
