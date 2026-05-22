/**
 * Phase 1.9.47 — Sandbox constraint engine (deterministic, simulation only).
 */
import { signObject } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { checkStageExposure, type SandboxGuardViolation } from './sponsorSandboxSafetyGuards';
import type { SponsorSandboxRolloutStage } from './sponsorSandboxInternals';

export interface SandboxConstraintEvaluation {
  readonly stage: SponsorSandboxRolloutStage;
  readonly requestedExposurePct: number;
  readonly requestedConcurrentActivations: number;
  readonly violations: ReadonlyArray<SandboxGuardViolation>;
  readonly admitted: boolean;
  readonly evaluationSignature: string;
}

export function simulateConstraintEvaluation(input: {
  stage: SponsorSandboxRolloutStage;
  requestedExposurePct: number;
  requestedConcurrentActivations: number;
}): SandboxConstraintEvaluation {
  const violations = checkStageExposure(input);
  const admitted = violations.length === 0;
  const payload = {
    stage: input.stage,
    requestedExposurePct: input.requestedExposurePct,
    requestedConcurrentActivations: input.requestedConcurrentActivations,
    violations: violations.map((v) => ({ guard: v.guard, stage: v.stage, detail: v.detail })),
    admitted,
  };
  return Object.freeze({
    ...payload,
    violations: Object.freeze(violations),
    evaluationSignature: signObject(payload),
  });
}
