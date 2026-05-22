/**
 * Phase 1.9.47 — Sandbox safety guards.
 */
import { SPONSOR_SANDBOX_INTERNALS } from './sponsorSandboxInternals';
import { SPONSOR_SANDBOX_EXECUTION_LIMITS } from './sponsorSandboxExecutionLimits';
import { SPONSOR_SANDBOX_THRESHOLDS, type SponsorSandboxThreshold } from './sponsorSandboxThresholds';
import type { SponsorSandboxRolloutStage } from './sponsorSandboxInternals';

export interface SandboxGuardViolation {
  readonly guard: string;
  readonly stage: SponsorSandboxRolloutStage | 'global';
  readonly detail: string;
}

export function assertNoRealSideEffects(): true {
  if (SPONSOR_SANDBOX_INTERNALS.realNetworkingAllowed) throw new Error('sandbox:real_networking');
  if (SPONSOR_SANDBOX_INTERNALS.realPersistenceAllowed) throw new Error('sandbox:real_persistence');
  if (SPONSOR_SANDBOX_INTERNALS.realBillingAllowed) throw new Error('sandbox:real_billing');
  if (SPONSOR_SANDBOX_INTERNALS.realSchedulingAllowed) throw new Error('sandbox:real_scheduling');
  return true;
}

export function thresholdForStage(stage: SponsorSandboxRolloutStage): SponsorSandboxThreshold {
  return SPONSOR_SANDBOX_THRESHOLDS.find((t) => t.stage === stage)!;
}

export interface SandboxStageExposureCheckInput {
  readonly stage: SponsorSandboxRolloutStage;
  readonly requestedExposurePct: number;
  readonly requestedConcurrentActivations: number;
}

export function checkStageExposure(
  input: SandboxStageExposureCheckInput,
): ReadonlyArray<SandboxGuardViolation> {
  const t = thresholdForStage(input.stage);
  const violations: SandboxGuardViolation[] = [];
  if (input.requestedExposurePct > t.maxExposurePct) {
    violations.push(Object.freeze({
      guard: 'exposure_cap',
      stage: input.stage,
      detail: `requested=${input.requestedExposurePct}% > cap=${t.maxExposurePct}%`,
    }));
  }
  if (input.requestedConcurrentActivations > t.maxConcurrentActivations) {
    violations.push(Object.freeze({
      guard: 'concurrency_cap',
      stage: input.stage,
      detail: `requested=${input.requestedConcurrentActivations} > cap=${t.maxConcurrentActivations}`,
    }));
  }
  if (input.requestedConcurrentActivations > SPONSOR_SANDBOX_EXECUTION_LIMITS.maxSimulatedActivationsPerStage) {
    violations.push(Object.freeze({
      guard: 'execution_limit',
      stage: input.stage,
      detail: 'exceeds maxSimulatedActivationsPerStage',
    }));
  }
  return Object.freeze(violations);
}
