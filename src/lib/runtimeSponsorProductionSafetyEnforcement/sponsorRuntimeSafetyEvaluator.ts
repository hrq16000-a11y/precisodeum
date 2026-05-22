/**
 * Phase 1.9.48 — Runtime safety evaluator.
 */
import { signObject, deepFreeze } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import {
  evaluateSafetyConstraints,
  type SafetyConstraintInput,
  type SafetyConstraintEvaluation,
} from './sponsorSafetyConstraintEngine';
import { enforceFailClosedPolicy, type FailClosedDecision } from './sponsorFailClosedPolicy';

export interface RuntimeSafetyReport {
  readonly version: 'v1';
  readonly evaluation: SafetyConstraintEvaluation;
  readonly decision: FailClosedDecision;
  readonly reportSignature: string;
}

export function evaluateRuntimeSafety(input: SafetyConstraintInput = {}): RuntimeSafetyReport {
  const evaluation = evaluateSafetyConstraints(input);
  const decision = enforceFailClosedPolicy(evaluation.violations);
  return deepFreeze({
    version: 'v1' as const,
    evaluation,
    decision,
    reportSignature: signObject({
      ev: evaluation.evaluationSignature,
      dc: decision.decisionSignature,
    }),
  });
}

export function assertActivationSafety(input: SafetyConstraintInput = {}): boolean {
  // Fail-closed: even with no violations, activation is not granted by this plane
  // (this plane only blocks; it never authorizes activation).
  return evaluateRuntimeSafety(input).decision.allow === false;
}

export function resolveSafetyViolations(input: SafetyConstraintInput) {
  return evaluateRuntimeSafety(input).evaluation.violations;
}
